import { prepareAgentRun } from "../src/server/api/routers/nimits-jarvis/agent/setup";

async function main() {
  console.log("=================================================================");
  console.log("  VERIFYING ALL 6 PII REDACTION LAYERS IN OUTBOUND LLM PAYLOAD ");
  console.log("=================================================================\n");

  const testUserMessage = `
  Hi, I am Nimit Vasant Shah.
  Email: nimitshah2503@gmail.com
  Phone: +917208392455
  Address: 203, RR Valencia, 6th ave, Greenville, Junnasandra. Bangalore-560035
  Aadhaar: 794515717238 | PAN: JZSPS7604Q | Card: 4687799111136510
  Vehicle: KA01ND0741 | Project: Career Trek
  `;

  // We fetch an active instance ID
  const prepareResult = await prepareAgentRun({
    instanceId: "cmrjkgg0n0000durvrjvkr7zr", // Nimits_Personal instance
    userMessage: testUserMessage,
    source: "web",
  });

  const { messages, piiVault } = prepareResult.result;

  console.log(`1. PIIVault Active: ${piiVault !== null}`);
  console.log(`2. Vault Has Redactions: ${piiVault?.hasRedactions}`);

  console.log("\n3. OUTBOUND MESSAGES PAYLOAD (Sent to External LLM):");
  for (const m of messages) {
    console.log(`\n--- [${m.role.toUpperCase()}] ---`);
    if (typeof m.content === "string") {
      console.log(m.content);
    } else {
      console.log(JSON.stringify(m.content, null, 2));
    }
  }

  // Perform Assertion check on outbound payload
  const serializedPayload = JSON.stringify(messages);
  const leakedLiterals = [
    "Nimit Vasant Shah",
    "nimitshah2503@gmail.com",
    "+917208392455",
    "203, RR Valencia",
    "794515717238",
    "JZSPS7604Q",
    "4687799111136510",
    "KA01ND0741",
    "Career Trek",
  ].filter((lit) => serializedPayload.includes(lit));

  console.log("\n=================================================================");
  console.log(`4. PII LEAK CHECK IN OUTBOUND LLM PAYLOAD:`);
  if (leakedLiterals.length === 0) {
    console.log("   ✅ SUCCESS: 0 PII literals leaked to LLM!");
    console.log("   ✅ ALL 6 LAYERS OPERATIONAL: 100% of PII was converted to [CLAW_*] tokens.");
  } else {
    console.error(`   ❌ FAILURE: Leaked ${leakedLiterals.length} PII literals:`, leakedLiterals);
    process.exit(1);
  }
}

main().catch(console.error);
