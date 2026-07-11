import { env } from "../src/env";

async function testWhisper() {
  console.log("Whisper URL:", env.WHISPER_BASE_URL);
  console.log("Whisper Model:", env.WHISPER_MODEL);
  
  // We can check if we have any audio files we can send.
  // Let's list files in the current folder or temp folder.
}

testWhisper().catch(console.error);
