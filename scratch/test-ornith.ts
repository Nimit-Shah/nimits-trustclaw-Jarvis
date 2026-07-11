import { generateText } from "ai";
import { createOllama } from "ai-sdk-ollama";

const ollama = createOllama();

async function test() {
  try {
    const { text } = await generateText({
      model: ollama("ornith:9b", {
        options: { num_ctx: 16000 }
      }),
      prompt: "Hello ornith",
      // test if providerOptions causes it
      providerOptions: {
        ollama: { think: false }
      }
    });
    console.log("Success with providerOptions:", text);
  } catch (err) {
    console.error("Error with providerOptions:", err);
  }

  try {
    const { text } = await generateText({
      model: ollama("ornith:9b", {
        options: { num_ctx: 16000 }
      }),
      prompt: "Hello ornith without providerOptions",
    });
    console.log("Success without providerOptions:", text);
  } catch (err) {
    console.error("Error without providerOptions:", err);
  }
}

test();
