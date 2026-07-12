import { createMemorySaveTool } from "~/server/api/routers/nimits-jarvis/agent/tools/memory-save";
import { createMemorySearchTool } from "~/server/api/routers/nimits-jarvis/agent/tools/memory-search";
import { db } from "~/server/clients/db";

async function runTests() {
  console.log("Fetching a valid instance...");
  
  const instance = await db.composioClawInstance.findFirst();
  if (!instance) {
    console.error("No instance found in DB to test with. Aborting.");
    return;
  }
  
  const realInstanceId = instance.id;
  console.log(`Using instanceId: ${realInstanceId}`);

  const saveTool = createMemorySaveTool(realInstanceId);
  const searchTool = createMemorySearchTool(realInstanceId);

  if (typeof saveTool.execute !== 'function' || typeof searchTool.execute !== 'function') {
    console.error("Tool execution functions are missing.");
    return;
  }

  console.log("\n--- 1. Testing memory-save ---");
  const saveResult = await saveTool.execute({
    content: "I want to deploy NimitsJarvis using Vercel. Also, my project is called Project Aurora.",
  }, {
    toolCallId: "test",
    messages: []
  });
  console.log("Save Result:", saveResult);

  console.log("\nWaiting 2 seconds for async sidecar & indexing...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n--- 2. Testing memory-search ---");
  const searchResult = await searchTool.execute({
    query: "What is my project name and deployment preference?",
    maxResults: 3,
  }, {
    toolCallId: "test",
    messages: []
  });
  
  console.log("Search Result:");
  console.dir(searchResult, { depth: null });

  console.log("\nTest completed.");
}

runTests().catch(console.error).finally(() => process.exit(0));
