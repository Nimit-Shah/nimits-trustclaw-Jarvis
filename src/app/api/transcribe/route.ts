import { auth } from "~/server/auth";
import { env } from "~/env";

/**
 * POST /api/transcribe
 *
 * Authenticated proxy to the local Whisper STT server.
 * Accepts multipart/form-data with an `audio` file field.
 * Returns { text: string } or a structured error.
 *
 * Audio never leaves the local network — the Whisper server runs
 * on the user's machine at WHISPER_BASE_URL.
 */
export async function POST(request: Request) {
  // 1. Authenticate
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  // 2. Parse the incoming audio blob
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data", code: "BAD_REQUEST" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return Response.json({ error: "Missing audio field", code: "BAD_REQUEST" }, { status: 400 });
  }

  // 3. Forward to local Whisper server
  const whisperForm = new FormData();
  whisperForm.append("file", audio, "recording.webm");
  whisperForm.append("model", env.WHISPER_MODEL);

  let whisperRes: Response;
  try {
    whisperRes = await fetch(`${env.WHISPER_BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      body: whisperForm,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    return Response.json(
      {
        error: isTimeout ? "Whisper server timed out" : "Whisper server is unreachable",
        code: "WHISPER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  if (!whisperRes.ok) {
    return Response.json(
      { error: "Whisper transcription failed", code: "TRANSCRIPTION_FAILED" },
      { status: 500 },
    );
  }

  // 4. Return the transcription text
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await whisperRes.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const text = typeof result?.text === "string" ? result.text : "";
  return Response.json({ text });
}
