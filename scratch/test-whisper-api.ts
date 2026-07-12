import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

async function main() {
  const tmpDir = "/Users/ayunimusmac/nimits-jarvis/tmp";
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const aiffPath = path.join(tmpDir, "test.aiff");
  const wavPath = path.join(tmpDir, "test.wav");

  try {
    console.log("Generating test audio with 'say'...");
    await execAsync(`say -v "Daniel (Enhanced)" "Hello, testing transcription" -o "${aiffPath}"`);
    console.log("Converting to WAV with 'afconvert'...");
    await execAsync(`afconvert -f WAVE -d LEI16@16000 "${aiffPath}" "${wavPath}"`);

    console.log("Sending WAV to Whisper server...");
    const fileData = fs.readFileSync(wavPath);
    const blob = new Blob([fileData], { type: "audio/wav" });
    const formData = new FormData();
    formData.append("file", blob, "test.wav");
    formData.append("model", "large-v3-v20240930_626MB");

    const res = await fetch("http://127.0.0.1:8081/v1/audio/transcriptions", {
      method: "POST",
      body: formData,
    });

    console.log("Response status:", res.status);
    const body = await res.text();
    console.log("Response body:", body);

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // cleanup
    try {
      if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    } catch {}
  }
}

main();
