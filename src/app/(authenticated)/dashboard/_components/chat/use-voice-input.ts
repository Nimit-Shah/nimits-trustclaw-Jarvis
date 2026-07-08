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
  /** Silence duration in ms before auto-stop. Default: 1500ms */
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

const SILENCE_THRESHOLD = 0.015; // RMS amplitude below this = silence
const VOLUME_POLL_INTERVAL_MS = 33; // ~30fps

export function useVoiceInput({
  onTranscribed,
  silenceDurationMs = 1500,
  maxDurationMs = 60_000,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audiCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCounterRef = useRef(0);
  const hasAudioRef = useRef(false); // Don't stop before user even spoke

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (volumePollRef.current) clearInterval(volumePollRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audiCtxRef.current?.close();
    audiCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  /** Sends collected audio chunks to /api/transcribe */
  const transcribe = useCallback(
    async (chunks: Blob[]) => {
      setState("transcribing");
      setVolume(0);

      const audioBlob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
      const form = new FormData();
      form.append("audio", audioBlob, "recording.webm");

      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Transcription failed");
        }
        const { text } = (await res.json()) as { text: string };
        setState("idle");
        if (text.trim()) {
          onTranscribed(text.trim());
        }
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Transcription failed");
      }
    },
    [onTranscribed],
  );

  const stopRecording = useCallback(() => {
    clearTimers();

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop(); // triggers `onstop` → transcribe
    } else {
      setState("idle");
      setVolume(0);
    }

    releaseStream();
  }, [clearTimers, releaseStream]);

  const startRecording = useCallback(async () => {
    setError(null);
    setState("requesting-permission");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setError("Microphone permission denied. Please allow mic access and try again.");
      return;
    }

    streamRef.current = stream;
    audioChunksRef.current = [];
    hasAudioRef.current = false;
    silenceCounterRef.current = 0;

    // ── Web Audio API for real-time volume analysis (VAD) ──
    const audioCtx = new AudioContext();
    audiCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Float32Array(analyser.fftSize);

    // ── MediaRecorder ──
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      void transcribe(audioChunksRef.current);
    };

    recorder.start(100); // collect data every 100ms
    setState("recording");

    // ── Volume polling + silence detection ──
    volumePollRef.current = setInterval(() => {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(dataArray);

      // Compute RMS
      let sumSq = 0;
      for (const sample of dataArray) sumSq += sample * sample;
      const rms = Math.sqrt(sumSq / dataArray.length);

      // Scale to 0-100 for the UI
      const scaledVolume = Math.min(100, Math.round(rms * 800));
      setVolume(scaledVolume);

      if (rms > SILENCE_THRESHOLD) {
        hasAudioRef.current = true;
        silenceCounterRef.current = 0;
      } else if (hasAudioRef.current) {
        // Only start counting silence after user has spoken at least once
        silenceCounterRef.current += VOLUME_POLL_INTERVAL_MS;
        if (silenceCounterRef.current >= silenceDurationMs) {
          stopRecording();
        }
      }
    }, VOLUME_POLL_INTERVAL_MS);

    // ── Safety: max duration cap ──
    maxDurationTimerRef.current = setTimeout(() => {
      stopRecording();
    }, maxDurationMs);
  }, [silenceDurationMs, maxDurationMs, stopRecording, transcribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      releaseStream();
    };
  }, [clearTimers, releaseStream]);

  return { state, volume, error, startRecording, stopRecording };
}
