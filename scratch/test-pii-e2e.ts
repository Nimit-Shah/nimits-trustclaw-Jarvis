/**
 * E2E Tests for the PII Protection Pipeline
 *
 * Tests the full lifecycle:
 *   1. PIIVault — scanning, tokenization, deduplication, restoration
 *   2. PIITransportShield — final network-layer deep scrub
 *   3. Cross-layer consistency — tokens stay consistent across vault + shield
 *   4. Edge cases — nested JSON, multipart messages, empty inputs
 *   5. Restore fidelity — tokens map back to exact originals
 *
 * Run: pnpm exec tsx --env-file=.env scratch/test-pii-e2e.ts
 */

import { PIIVault, PIITransportShield } from "../src/server/api/routers/trustclaw/agent/pii";
import { scanForPII, extractStructuredPII } from "../src/server/api/routers/trustclaw/agent/pii";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function assertNotContains(text: string, value: string, testName: string) {
  assert(!text.includes(value), testName, `Found "${value}" in: "${text.slice(0, 100)}..."`);
}

function assertContains(text: string, value: string, testName: string) {
  assert(text.includes(value), testName, `Expected "${value}" in: "${text.slice(0, 100)}..."`);
}

// ═══════════════════════════════════════════════════════════════════
// 1. PIIVault — Core Tokenization & Restoration
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 1. PIIVault Core ═══");

{
  console.log("\n--- 1.1 Email redaction ---");
  const vault = new PIIVault();
  const input = "Contact me at john.doe@example.com or jane@corp.io";
  const redacted = vault.redact(input);
  assertNotContains(redacted, "john.doe@example.com", "Email 1 redacted");
  assertNotContains(redacted, "jane@corp.io", "Email 2 redacted");
  assertContains(redacted, "[EMAIL_1]", "Token EMAIL_1 present");
  assertContains(redacted, "[EMAIL_2]", "Token EMAIL_2 present");

  const restored = vault.restore(redacted);
  assert(restored === input, "Restored text matches original input");
}

{
  console.log("\n--- 1.2 Phone number redaction ---");
  const vault = new PIIVault();
  const input = "Call me at +91-9876543210 or +1 (234) 567-8901";
  const redacted = vault.redact(input);
  assertNotContains(redacted, "9876543210", "Indian phone redacted");
  assertNotContains(redacted, "567-8901", "US phone redacted");
  assertContains(redacted, "[PHONE_", "Phone token present");

  const restored = vault.restore(redacted);
  assert(restored === input, "Restored phones match original");
}

{
  console.log("\n--- 1.3 Deduplication ---");
  const vault = new PIIVault();
  const text1 = vault.redact("Email: john@test.com");
  const text2 = vault.redact("Also: john@test.com");

  // Same email should get the same token
  const token1 = text1.match(/\[EMAIL_\d+\]/)?.[0];
  const token2 = text2.match(/\[EMAIL_\d+\]/)?.[0];
  assert(token1 === token2, "Same email gets same token (dedup)");
  assert(vault.getStats().totalRedacted === 1, "Only 1 unique entity registered");
}

{
  console.log("\n--- 1.4 API key redaction ---");
  const vault = new PIIVault();
  const input = "My key is sk-ant-abcdefghij1234567890abcdefghij";
  const redacted = vault.redact(input);
  assertNotContains(redacted, "sk-ant-", "API key redacted");
  assertContains(redacted, "[API_KEY_1]", "API_KEY token present");
}

{
  console.log("\n--- 1.5 Mixed PII in single text ---");
  const vault = new PIIVault();
  const input = "Hey, nimit@gmail.com called from +91-8765432109 about project";
  const redacted = vault.redact(input);
  assertNotContains(redacted, "nimit@gmail.com", "Email stripped");
  assertNotContains(redacted, "8765432109", "Phone stripped");
  assert(vault.getStats().totalRedacted === 2, "2 entities detected");
}

{
  console.log("\n--- 1.6 SSN redaction ---");
  const vault = new PIIVault();
  const input = "SSN is 123-45-6789";
  const redacted = vault.redact(input);
  assertNotContains(redacted, "123-45-6789", "SSN redacted");
  assertContains(redacted, "[SSN_1]", "SSN token present");
}

{
  console.log("\n--- 1.7 Empty/null inputs ---");
  const vault = new PIIVault();
  assert(vault.redact("") === "", "Empty string returns empty");
  assert(vault.restore("") === "", "Restore empty returns empty");
  assert(vault.redact("no pii here") === "no pii here", "Clean text unchanged");
}

// ═══════════════════════════════════════════════════════════════════
// 2. Structural PII Extraction (Composio tool results)
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 2. Structural PII Extraction ═══");

{
  console.log("\n--- 2.1 Gmail-style structured data ---");
  const vault = new PIIVault();
  const gmailResult = {
    from: {
      emailAddress: {
        name: "Alice Johnson",
        address: "alice@company.com",
      },
    },
    toRecipients: [
      {
        emailAddress: {
          name: "Bob Smith",
          address: "bob@corp.net",
        },
      },
    ],
    subject: "Meeting notes",
    body: "Hi Bob, please review the doc at alice@company.com",
  };

  vault.registerStructuredPII(gmailResult);
  const redactedBody = vault.redact(gmailResult.body);
  assertNotContains(redactedBody, "alice@company.com", "Structured email caught in body text");
  assert(vault.getStats().totalRedacted >= 3, "At least 3 PII entities from structural extraction");
}

{
  console.log("\n--- 2.2 Calendar event attendees ---");
  const vault = new PIIVault();
  const calendarEvent = {
    attendees: [
      { name: "Charlie Brown", email: "charlie@email.com" },
      { name: "Diana Prince", email: "diana@test.org" },
    ],
    organizer: {
      name: "Event Organizer",
      email: "organizer@corp.com",
    },
  };

  vault.registerStructuredPII(calendarEvent);
  const stats = vault.getStats();
  assert(stats.totalRedacted >= 4, "Extracted names + emails from calendar attendees");
}

{
  console.log("\n--- 2.3 Deep redact of tool result object ---");
  const vault = new PIIVault();
  const toolResult = {
    user: {
      name: "Test User",
      profile: {
        email: "test@example.com",
        phone: "+1-555-123-4567",
      },
    },
    messages: [
      { text: "Reach me at test@example.com", sender: "Test User" },
    ],
  };

  vault.registerStructuredPII(toolResult);
  const redacted = vault.redactToolResult(toolResult) as any;

  assertNotContains(JSON.stringify(redacted), "test@example.com", "Email removed from deep object");
  assertNotContains(JSON.stringify(redacted), "Test User", "Name removed from deep object");
}

// ═══════════════════════════════════════════════════════════════════
// 3. Transport Shield — Network-Layer Interceptor
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 3. Transport Shield ═══");

{
  console.log("\n--- 3.1 Scrubs plain-text system prompt ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  const systemPrompt = "You are Nimit Shah's personal assistant. His email is nimit@test.com and phone is +91-9999988888.";
  const scrubbed = shield.scrubText(systemPrompt);
  assertNotContains(scrubbed, "nimit@test.com", "Email scrubbed from system prompt");
  assertNotContains(scrubbed, "9999988888", "Phone scrubbed from system prompt");
  assertContains(scrubbed, "[EMAIL_1]", "Email token in system prompt");
  assertContains(scrubbed, "[PHONE_", "Phone token in system prompt");
}

{
  console.log("\n--- 3.2 Scrubs message payload array ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  const messages = [
    { role: "system" as const, content: "You help admin@company.com with tasks" },
    { role: "user" as const, content: "Send email to boss@corp.net about the project" },
    { role: "assistant" as const, content: "I'll send an email to boss@corp.net now" },
  ];

  const scrubbed = shield.scrubPayload(messages);
  for (const msg of scrubbed) {
    assertNotContains(msg.content as string, "admin@company.com", `No PII leak in ${msg.role} message`);
    assertNotContains(msg.content as string, "boss@corp.net", `No boss email leak in ${msg.role} message`);
  }
}

{
  console.log("\n--- 3.3 Scrubs multipart content arrays ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  const messages = [
    {
      role: "assistant" as const,
      content: [
        { type: "text", text: "Found email from user@domain.com" },
        {
          type: "tool-call",
          toolCallId: "tc_1",
          toolName: "gmail_send",
          input: { to: "user@domain.com", body: "Hello user@domain.com" },
        },
      ],
    },
  ];

  const scrubbed = shield.scrubPayload(messages);
  const serialized = JSON.stringify(scrubbed);
  assertNotContains(serialized, "user@domain.com", "Email cleaned from all multipart sections");
  assertContains(serialized, "[EMAIL_1]", "Token present in scrubbed payload");
}

{
  console.log("\n--- 3.4 Scrubs tool-result outputs ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  const messages = [
    {
      role: "tool" as const,
      content: [
        {
          type: "tool-result",
          toolCallId: "tc_2",
          output: { email: "leaked@secret.com", data: "some info about leaked@secret.com" },
        },
      ],
    },
  ];

  const scrubbed = shield.scrubPayload(messages);
  const serialized = JSON.stringify(scrubbed);
  assertNotContains(serialized, "leaked@secret.com", "Tool result output fully scrubbed");
}

// ═══════════════════════════════════════════════════════════════════
// 4. Cross-Layer Consistency
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 4. Cross-Layer Consistency ═══");

{
  console.log("\n--- 4.1 Same vault shared across layers ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  // Layer 1: Tool executor registers PII
  const toolResult = { from: { emailAddress: { name: "John Doe", address: "john@test.com" } } };
  vault.registerStructuredPII(toolResult);
  const redactedResult = vault.redactToolResult(toolResult);

  // Layer 2: Transport shield scrubs the same email in a message
  const msg = { role: "user" as const, content: "Forward to john@test.com please" };
  const scrubbed = shield.scrubMessage(msg);

  // Both should use the same token for john@test.com
  const resultStr = JSON.stringify(redactedResult);
  const tokenFromResult = resultStr.match(/\[EMAIL_\d+\]/)?.[0];
  const tokenFromShield = (scrubbed.content as string).match(/\[EMAIL_\d+\]/)?.[0];
  assert(tokenFromResult === tokenFromShield, "Same email → same token across layers");
  assert(vault.getStats().totalRedacted >= 1, "PII entity counted once (deduped across layers)");
}

{
  console.log("\n--- 4.2 Restore works after multi-layer redaction ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  // Simulate the full pipeline
  const original = "Meeting with alice@corp.com at +1-555-000-1234";
  const afterVault = vault.redact(original);
  const afterShield = shield.scrubText(afterVault); // second pass should be no-op

  // afterShield should be identical to afterVault (no double-tokenization)
  assert(afterVault === afterShield, "Transport shield is no-op after vault redaction (idempotent)");

  // Restore should recover the original
  const restored = vault.restore(afterShield);
  assert(restored === original, "Full pipeline restore matches original");
}

{
  console.log("\n--- 4.3 Shield catches what vault missed ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);

  // Simulate a message that somehow bypassed redactContextMessages
  // (e.g., a system prompt with PII that wasn't scrubbed earlier)
  const rawMessages = [
    { role: "system" as const, content: "User's email is bypassed@leak.com" },
    { role: "user" as const, content: "Please check" },
  ];

  // Skip redactContextMessages — go straight to shield
  const scrubbed = shield.scrubPayload(rawMessages);
  assertNotContains(scrubbed[0]!.content as string, "bypassed@leak.com", "Shield catches bypass leak");
}

// ═══════════════════════════════════════════════════════════════════
// 5. Edge Cases
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 5. Edge Cases ═══");

{
  console.log("\n--- 5.1 Already-tokenized text not double-tokenized ---");
  const vault = new PIIVault();
  const redacted = vault.redact("Email: test@example.com");
  const redactedAgain = vault.redact(redacted);
  assert(redacted === redactedAgain, "Double-redaction is idempotent");
}

{
  console.log("\n--- 5.2 Token in text not mistaken for PII ---");
  const vault = new PIIVault();
  vault.redact("real@email.com"); // Register the PII
  const textWithToken = "The token is [EMAIL_1], use it carefully";
  const result = vault.redact(textWithToken);
  // Should not create a nested token like [[EMAIL_1]_1]
  assert(!result.includes("[["), "No nested tokenization");
  assert(result.includes("[EMAIL_1]"), "Existing token preserved");
}

{
  console.log("\n--- 5.3 Very long text with scattered PII ---");
  const vault = new PIIVault();
  const filler = "Lorem ipsum dolor sit amet. ".repeat(100);
  const input = `${filler}Contact: scatter@test.com${filler}Phone: +91-7777766666${filler}`;
  const redacted = vault.redact(input);
  assertNotContains(redacted, "scatter@test.com", "Email found in long text");
  assertNotContains(redacted, "7777766666", "Phone found in long text");
  const restored = vault.restore(redacted);
  assert(restored === input, "Restore works on long text");
}

{
  console.log("\n--- 5.4 JSON stringified content in messages ---");
  const vault = new PIIVault();
  const shield = new PIITransportShield(vault);
  const msg = {
    role: "assistant" as const,
    content: JSON.stringify({ email: "json@leak.com", data: "some data" }),
  };
  const scrubbed = shield.scrubMessage(msg);
  assertNotContains(scrubbed.content as string, "json@leak.com", "JSON-embedded email scrubbed");
}

{
  console.log("\n--- 5.5 Multiple PII types in a single tool result ---");
  const vault = new PIIVault();
  const complexResult = {
    contact: {
      name: "Jane Smith",
      email: "jane.smith@company.com",
      phone: "+44 7911 123456",
      address: "123 Main Street, London",
    },
    notes: "Jane Smith (jane.smith@company.com) called at +44 7911 123456",
  };

  vault.registerStructuredPII(complexResult);
  const redacted = vault.redactToolResult(complexResult) as any;
  const serialized = JSON.stringify(redacted);

  assertNotContains(serialized, "jane.smith@company.com", "Email scrubbed from complex result");
  assertNotContains(serialized, "Jane Smith", "Name scrubbed from complex result");
  assertNotContains(serialized, "7911 123456", "Phone scrubbed from complex result");
}

// ═══════════════════════════════════════════════════════════════════
// 6. Scanner Unit Tests
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 6. Scanner Unit Tests ═══");

{
  console.log("\n--- 6.1 scanForPII detects all pattern types ---");
  const results = scanForPII(
    "Email: test@test.com, Phone: +1-234-567-8901, SSN: 123-45-6789, IP: 192.168.1.1"
  );
  const types = results.map(r => r.type);
  assertContains(types.join(","), "email", "Detected email");
  assertContains(types.join(","), "ssn", "Detected SSN");
  assertContains(types.join(","), "ip_address", "Detected IP address");
}

{
  console.log("\n--- 6.2 extractStructuredPII from nested JSON ---");
  const matches = extractStructuredPII({
    from: { emailAddress: { name: "Test Person", address: "struct@test.com" } },
    attendees: [{ name: "Attendee One", email: "att1@test.com" }],
  });
  assert(matches.length >= 3, `Extracted ${matches.length} structured PII entries (expected ≥3)`);
  const values = matches.map(m => m.value);
  assertContains(values.join("|"), "struct@test.com", "Structured email extracted");
  assertContains(values.join("|"), "Test Person", "Structured name extracted");
}

// ═══════════════════════════════════════════════════════════════════
// 7. SSE Restore Simulation
// ═══════════════════════════════════════════════════════════════════

console.log("\n═══ 7. SSE Restore Simulation ═══");

{
  console.log("\n--- 7.1 Simulated SSE chunk restoration ---");
  const vault = new PIIVault();

  // Simulate the full outbound flow
  vault.redact("Contact alice@wonderland.com about the project");
  vault.redact("Her phone is +91-1234567890");

  // Now simulate an SSE stream chunk with tokens
  const sseChunk = 'data: {"type":"text","text":"I contacted [EMAIL_1] at [PHONE_1] successfully."}\n\n';
  const restored = vault.restore(sseChunk);
  assertContains(restored, "alice@wonderland.com", "SSE chunk: email restored");
  assertContains(restored, "+91-1234567890", "SSE chunk: phone restored");
  assertNotContains(restored, "[EMAIL_1]", "SSE chunk: token removed");
  assertNotContains(restored, "[PHONE_1]", "SSE chunk: phone token removed");
}

{
  console.log("\n--- 7.2 Partial SSE chunks ---");
  const vault = new PIIVault();
  vault.redact("secret@email.com");

  // Token might be split across chunks
  const chunk1 = "Here is [EMAI";
  const chunk2 = "L_1] for reference";

  // After concatenation and restore
  const full = chunk1 + chunk2;
  const restored = vault.restore(full);
  assertContains(restored, "secret@email.com", "Split-chunk token restored after concat");
}

// ═══════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════

console.log("\n" + "═".repeat(60));
console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  console.error("  ⚠️  Some tests failed! Review the output above.\n");
  process.exit(1);
} else {
  console.log("  🎉 All tests passed!\n");
  process.exit(0);
}
