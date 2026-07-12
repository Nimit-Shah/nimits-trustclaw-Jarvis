import { scanForPII, extractStructuredPII } from "../src/server/api/routers/trustclaw/agent/pii/pii-scanner";
import { PIIVault } from "../src/server/api/routers/trustclaw/agent/pii/pii-tokenizer";
import { PIITransportShield } from "../src/server/api/routers/trustclaw/agent/pii/pii-transport-shield";

function runTests() {
  console.log("--- Test 1: Identity Pattern in Plain Text ---");
  const rawText = "Hello, my name is Ayuni Musmac. Please email me.";
  const matches = scanForPII(rawText);
  console.log("Matches found:", matches);
  
  if (matches.length > 0 && matches[0]?.type === "identity" && matches[0]?.value === "Ayuni Musmac") {
    console.log("✅ Identity match successful.");
  } else {
    console.error("❌ Identity match failed.");
  }

  console.log("\n--- Test 2: LinkedIn URL Structural Extraction ---");
  const structObj = {
    profileUrl: "https://www.linkedin.com/in/jackson-407499275",
    vanityName: "jackson-407499275"
  };
  const structMatches = extractStructuredPII(structObj);
  console.log("Structured Matches:", structMatches);
  
  const hasLinkedIn = structMatches.some(m => m.type === "linkedin_url" && m.value === "https://www.linkedin.com/in/jackson-407499275");
  if (hasLinkedIn) {
    console.log("✅ LinkedIn URL structural bypass successful.");
  } else {
    console.error("❌ LinkedIn URL structural bypass failed.");
  }

  console.log("\n--- Test 3: End-to-End Vault Shield Test ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  const payload = [
    {
      role: "user" as const,
      content: "Hello I am Nimit Shah. My profile is https://www.linkedin.com/in/nimit-123"
    },
    {
      role: "tool" as const,
      content: [
        {
          type: "tool-result",
          output: {
            profileUrl: "https://www.linkedin.com/in/jackson-407499275",
            email: "nimit@example.com"
          }
        }
      ]
    }
  ];

  const scrubbed = shield.scrubPayload(payload);
  console.log("Original Payload:");
  console.dir(payload, { depth: null });
  console.log("\nScrubbed Payload:");
  console.dir(scrubbed, { depth: null });
  console.log("\nVault Stats:");
  console.dir(vault.getStats());
}

runTests();
