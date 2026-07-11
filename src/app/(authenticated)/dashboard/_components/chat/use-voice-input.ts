"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceInputState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "transcribing"
  | "error";

interface UseVoiceInputOptions {
  /** Called with the final transcribed text once Whisper responds. */
  onTranscribed: (text: string) => void;
  /** Silence duration in ms before auto-stop. Default: 1000ms */
  silenceDurationMs?: number;
  /** Max recording duration in ms (safety cap). Default: 60000ms */
  maxDurationMs?: number;
}

interface UseVoiceInputReturn {
  state: VoiceInputState;
  /** Real-time volume level 0–100, updated ~30fps while recording. */
  volume: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

const SILENCE_THRESHOLD = 0.012; // RMS amplitude below this = silence
const VOLUME_POLL_INTERVAL_MS = 33; // ~30fps

// ── WAV Encoder ─────────────────────────────────────────────────────────────
function bufferToWav(
  pcmBuffers: Float32Array[],
  sampleRate: number,
): Blob {
  const totalLength = pcmBuffers.reduce((s, b) => s + b.length, 0);
  const numOfChan = 1; // mono
  const bitDepth = 16;
  const byteRate = sampleRate * numOfChan * (bitDepth / 8);
  const blockAlign = numOfChan * (bitDepth / 8);
  const dataByteLen = totalLength * (bitDepth / 8);
  const arrayBuffer = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(arrayBuffer);

  let pos = 0;
  const str = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i)); };
  const u32 = (v: number) => { view.setUint32(pos, v, true); pos += 4; };
  const u16 = (v: number) => { view.setUint16(pos, v, true); pos += 2; };

  str("RIFF");   u32(36 + dataByteLen);
  str("WAVE");
  str("fmt ");   u32(16);
  u16(1);        // PCM format
  u16(numOfChan);
  u32(sampleRate);
  u32(byteRate);
  u16(blockAlign);
  u16(bitDepth);
  str("data");   u32(dataByteLen);

  // Write interleaved PCM samples
  let offset = pos;
  for (const buf of pcmBuffers) {
    for (let i = 0; i < buf.length; i++) {
      const s = Math.max(-1, Math.min(1, buf[i]!));
      const pcm = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, pcm, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export function useVoiceInput({
  onTranscribed,
  silenceDurationMs = 1000,
  maxDurationMs = 60_000,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Stable refs — avoids ALL stale closure bugs ──────────────────────────
  const onTranscribedRef = useRef(onTranscribed);
  const silenceDurationMsRef = useRef(silenceDurationMs);
  const maxDurationMsRef = useRef(maxDurationMs);
  useEffect(() => { onTranscribedRef.current = onTranscribed; }, [onTranscribed]);
  useEffect(() => { silenceDurationMsRef.current = silenceDurationMs; }, [silenceDurationMs]);
  useEffect(() => { maxDurationMsRef.current = maxDurationMs; }, [maxDurationMs]);

  // ── Audio node refs ──────────────────────────────────────────────────────
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordingBuffersRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44100);

  // ── Timer refs ───────────────────────────────────────────────────────────
  const volumePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCounterRef = useRef(0);
  const hasAudioRef = useRef(false);

  // ── State machine ref — the SOURCE OF TRUTH for callbacks ────────────────
  // Using a ref so setInterval / setTimeout callbacks always read current state
  // without needing to be recreated (which causes stale closures).
  const isRecordingRef = useRef(false);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Core teardown (stable — no deps needed) ──────────────────────────────
  const clearTimers = useCallback(() => {
    if (volumePollRef.current) { clearInterval(volumePollRef.current); volumePollRef.current = null; }
    if (maxDurationTimerRef.current) { clearTimeout(maxDurationTimerRef.current); maxDurationTimerRef.current = null; }
  }, []);

  const releaseAudio = useCallback(() => {
    try {
      scriptProcessorRef.current?.disconnect();
      if (scriptProcessorRef.current) scriptProcessorRef.current.onaudioprocess = null;
    } catch { /* ignore */ }
    try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
    try { analyserRef.current?.disconnect(); } catch { /* ignore */ }
    try { void audioCtxRef.current?.close(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });

    scriptProcessorRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
  }, []);

  // ── Transcription — always reads current callback via ref ─────────────────
  const doTranscribe = useCallback((buffers: Float32Array[], sampleRate: number) => {
    if (!isMountedRef.current) return;
    if (buffers.length === 0) {
      setState("idle");
      setVolume(0);
      return;
    }

    setState("transcribing");
    setVolume(0);

    const wavBlob = bufferToWav(buffers, sampleRate);
    const form = new FormData();
    form.append("audio", wavBlob, "recording.wav");

    fetch("/api/transcribe", { method: "POST", body: form })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json() as { error?: string };
          throw new Error(body.error ?? "Transcription failed");
        }
        return res.json() as Promise<{ text: string }>;
      })
      .then(({ text }) => {
        if (!isMountedRef.current) return;
        setState("idle");
        const trimmed = text.trim();
        if (trimmed) onTranscribedRef.current(trimmed);
      })
      .catch((err: unknown) => {
        if (!isMountedRef.current) return;
        setState("error");
        setError(err instanceof Error ? err.message : "Transcription failed");
      });
  }, []);

  // ── stopRecording — stable, reads state from ref ──────────────────────────
  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return; // idempotent
    isRecordingRef.current = false;

    clearTimers();

    // Snapshot buffers & sample rate BEFORE releasing audio nodes
    const buffers = [...recordingBuffersRef.current];
    const sampleRate = sampleRateRef.current;
    recordingBuffersRef.current = [];

    releaseAudio();

    if (isMountedRef.current) {
      doTranscribe(buffers, sampleRate);
    }
  }, [clearTimers, releaseAudio, doTranscribe]);

  // ── startRecording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return; // already recording

    setError(null);
    setState("requesting-permission");
    recordingBuffersRef.current = [];
    hasAudioRef.current = false;
    silenceCounterRef.current = 0;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setState("error");
      setError(err instanceof Error ? err.message : "Microphone permission denied.");
      return;
    }

    if (!isMountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;

    // AudioContext
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    sampleRateRef.current = audioCtx.sampleRate;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    analyserRef.current = analyser;

    // ScriptProcessor for raw PCM capture
    const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current = scriptProcessor;
    scriptProcessor.onaudioprocess = (e) => {
      if (!isRecordingRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      recordingBuffersRef.current.push(new Float32Array(input));
    };

    source.connect(analyser);
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioCtx.destination); // required for onaudioprocess

    isRecordingRef.current = true;
    setState("recording");

    const dataArray = new Float32Array(analyser.fftSize);

    // ── Volume polling + VAD silence detection ──
    volumePollRef.current = setInterval(() => {
      if (!isRecordingRef.current || !analyserRef.current) return;

      analyserRef.current.getFloatTimeDomainData(dataArray);

      let sumSq = 0;
      for (const s of dataArray) sumSq += s * s;
      const rms = Math.sqrt(sumSq / dataArray.length);
      const scaledVolume = Math.min(100, Math.round(rms * 800));

      if (isMountedRef.current) setVolume(scaledVolume);

      if (rms > SILENCE_THRESHOLD) {
        hasAudioRef.current = true;
        silenceCounterRef.current = 0;
      } else if (hasAudioRef.current) {
        silenceCounterRef.current += VOLUME_POLL_INTERVAL_MS;
        if (silenceCounterRef.current >= silenceDurationMsRef.current) {
          // Stop via the stable ref-based stopRecording
          stopRecording();
        }
      }
    }, VOLUME_POLL_INTERVAL_MS);

    // ── Safety max-duration cap ──
    maxDurationTimerRef.current = setTimeout(() => {
      stopRecording();
    }, maxDurationMsRef.current);
  }, [stopRecording]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isRecordingRef.current = false;
      clearTimers();
      releaseAudio();
      recordingBuffersRef.current = [];
    };
  }, [clearTimers, releaseAudio]);

  return { state, volume, error, startRecording, stopRecording };
}
