import { auth } from "~/server/auth";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink, writeFile } from "fs/promises";

const execFileAsync = promisify(execFile);

/**
 * POST /api/tts
 *
 * Converts text to speech using macOS `say -v "Daniel (Enhanced)"`.
 * Returns the audio as a WAV stream.
 *
 * Security:
 * - Text is written to a temp file and read via `say -f` to prevent shell injection.
 * - Input is capped at 5000 chars.
 */
export async function POST(request: Request) {
  // 1. Auth
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let text: string;
  try {
    const body = (await request.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "Missing text field" }, { status: 400 });
  }

  // Cap length to prevent abuse
  if (text.length > 5000) {
    text = text.slice(0, 5000);
  }

  const id = randomUUID();
  const textPath = `/tmp/jarvis-tts-${id}.txt`;
  const aiffPath = `/tmp/jarvis-tts-${id}.aiff`;
  const wavPath = `/tmp/jarvis-tts-${id}.wav`;

  try {
    // 3. Write text to temp file (prevents shell injection)
    await writeFile(textPath, text, "utf-8");

    // 4. Generate speech using macOS say with Daniel (Enhanced)
    await execFileAsync("say", [
      "-v", "Daniel (Enhanced)",
      "-f", textPath,
      "-o", aiffPath,
    ], { timeout: 30_000 });

    // 5. Convert AIFF → WAV using afconvert (built into macOS)
    await execFileAsync("afconvert", [
      "-f", "WAVE",
      "-d", "LEI16@22050",
      aiffPath,
      wavPath,
    ], { timeout: 10_000 });

    // 6. Read and stream the WAV file
    const wavBuffer = await readFile(wavPath);

    return new Response(wavBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": wavBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[TTS] Error:", err);
    return Response.json(
      { error: "Text-to-speech generation failed" },
      { status: 500 },
    );
  } finally {
    // 7. Cleanup temp files
    await Promise.allSettled([
      unlink(textPath),
      unlink(aiffPath),
      unlink(wavPath),
    ]);
  }
}
