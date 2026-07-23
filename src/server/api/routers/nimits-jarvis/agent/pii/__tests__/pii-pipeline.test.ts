/**
 * PII Pipeline Tests — Unit + Integration tests for the full PII protection system.
 *
 * Run: npx tsx src/server/api/routers/nimits-jarvis/agent/pii/__tests__/pii-pipeline.test.ts
 */

import { PIIVault } from "../pii-tokenizer";
import { PIITransportShield } from "../pii-transport-shield";
import { scanForPII, scanForPIIEnhanced, extractStructuredPII } from "../pii-scanner";
import { IdentityRegistry } from "../identity-registry";

// ─── Test Helpers ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ─── Tests ────────────────────────────────────────────────────────

async function runAllTests() {
  // ── PII Scanner (Layer 2: Regex) ──
  console.log("\n=== PII Scanner (Layer 2: Regex) ===\n");

  await runTest("detects email", () => {
    const matches = scanForPII("Contact me at john@example.com");
    assert(matches.length === 1, `expected 1 match, got ${matches.length}`);
    assert(matches[0]!.type === "email", `expected email, got ${matches[0]!.type}`);
    assert(matches[0]!.value === "john@example.com", `expected john@example.com, got ${matches[0]!.value}`);
  });

  await runTest("detects phone number", () => {
    const matches = scanForPII("Call me at +1 (234) 567-8901");
    assert(matches.length === 1, `expected 1 match, got ${matches.length}`);
    assert(matches[0]!.type === "phone", `expected phone, got ${matches[0]!.type}`);
  });

  await runTest("detects SSN", () => {
    const matches = scanForPII("SSN: 123-45-6789");
    assert(matches.length === 1, `expected 1 match, got ${matches.length}`);
    assert(matches[0]!.type === "ssn", `expected ssn, got ${matches[0]!.type}`);
  });

  await runTest("detects API key", () => {
    const matches = scanForPII("Key: sk-abcdefghijklmnopqrstuvwxyz123456");
    assert(matches.length === 1, `expected 1 match, got ${matches.length}`);
    assert(matches[0]!.type === "api_key", `expected api_key, got ${matches[0]!.type}`);
  });

  await runTest("detects LinkedIn URL", () => {
    const matches = scanForPII("Profile: https://linkedin.com/in/johndoe");
    assert(matches.length === 1, `expected 1 match, got ${matches.length}`);
    assert(matches[0]!.type === "linkedin_url", `expected linkedin_url, got ${matches[0]!.type}`);
  });

  await runTest("detects URN", () => {
    const matches = scanForPII("URN: urn:li:person:12345");
    assert(matches.length === 1, `expected 1 match, got ${matches.length}`);
    assert(matches[0]!.type === "urn", `expected urn, got ${matches[0]!.type}`);
  });

  await runTest("returns empty for no PII", () => {
    const matches = scanForPII("Hello world, how are you?");
    assert(matches.length === 0, `expected 0 matches, got ${matches.length}`);
  });

  // ── Structural Extraction (Layer 4) ──
  console.log("\n=== Structural Extraction (Layer 4) ===\n");

  await runTest("extracts from Gmail-style JSON", () => {
    const obj = {
      from: { emailAddress: { name: "Nimit Shah", address: "nimit@example.com" } },
      subject: "Hello",
    };
    const matches = extractStructuredPII(obj);
    const names = matches.filter((m) => m.type === "person_name");
    const emails = matches.filter((m) => m.type === "email");
    assert(names.length >= 1, `expected at least 1 name, got ${names.length}`);
    assert(emails.length >= 1, `expected at least 1 email, got ${emails.length}`);
  });

  await runTest("extracts from Calendar-style JSON", () => {
    const obj = {
      attendees: [
        { name: "John Doe", email: "john@example.com" },
        { name: "Jane Smith", email: "jane@example.com" },
      ],
      organizer: { name: "Bob", email: "bob@example.com" },
    };
    const matches = extractStructuredPII(obj);
    const names = matches.filter((m) => m.type === "person_name");
    assert(names.length >= 3, `expected at least 3 names, got ${names.length}`);
  });

  await runTest("returns empty for non-PII object", () => {
    const obj = { id: "123", status: "active", count: 42 };
    const matches = extractStructuredPII(obj);
    assert(matches.length === 0, `expected 0 matches, got ${matches.length}`);
  });

  // ── PIIVault (Tokenizer) ──
  console.log("\n=== PIIVault (Tokenizer) ===\n");

  await runTest("token format is [CLAW_TYPE_HASH]", () => {
    const vault = new PIIVault();
    const token = vault.registerPII("email", "test@example.com");
    assert(token.startsWith("[CLAW_"), `expected [CLAW_* token, got ${token}`);
    assert(token.endsWith("]"), `expected token to end with ], got ${token}`);
    assert(token.includes("EMAIL"), `expected EMAIL in token, got ${token}`);
  });

  await runTest("deduplicates same value", () => {
    const vault = new PIIVault();
    const token1 = vault.registerPII("email", "test@example.com");
    const token2 = vault.registerPII("email", "test@example.com");
    assert(token1 === token2, `expected same token, got ${token1} vs ${token2}`);
  });

  await runTest("different values get different tokens", () => {
    const vault = new PIIVault();
    const token1 = vault.registerPII("email", "a@example.com");
    const token2 = vault.registerPII("email", "b@example.com");
    assert(token1 !== token2, `expected different tokens, got ${token1} vs ${token2}`);
  });

  await runTest("hasRedactions reflects state", () => {
    const vault = new PIIVault();
    assert(!vault.hasRedactions, "expected no redactions initially");
    vault.registerPII("email", "test@test.com");
    assert(vault.hasRedactions, "expected redactions after register");
  });

  // ── Async PIIVault Tests ──
  console.log("\n=== PIIVault Async (redact/restore) ===\n");

  await runTest("redact replaces PII in text", async () => {
    const vault = new PIIVault();
    const result = await vault.redact("Email me at john@example.com");
    assert(!result.includes("john@example.com"), `expected PII redacted, got: ${result}`);
    assert(result.includes("[CLAW_"), `expected CLAW token, got: ${result}`);
  });

  await runTest("restore reverses redaction", async () => {
    const vault = new PIIVault();
    const redacted = await vault.redact("Email: john@example.com");
    const restored = vault.restore(redacted);
    assert(restored.includes("john@example.com"), `expected restored email, got: ${restored}`);
    assert(!restored.includes("[CLAW_"), `expected no CLAW tokens, got: ${restored}`);
  });

  await runTest("deep redact works on nested objects", async () => {
    const vault = new PIIVault();
    const input = { from: { email: "user@test.com", name: "Test User" }, body: "Hello world" };
    const redacted = await vault.redactToolResult(input);
    const json = JSON.stringify(redacted);
    assert(!json.includes("user@test.com"), `expected email redacted, got: ${json}`);
  });

  // ── Transport Shield ──
  console.log("\n=== Transport Shield ===\n");

  await runTest("scrubs text content", async () => {
    const vault = new PIIVault();
    vault.registerPII("email", "secret@test.com");
    const shield = new PIITransportShield(vault);
    const msg = { role: "user" as const, content: "My email is secret@test.com" };
    const scrubbed = await shield.scrubMessage(msg);
    assert(!scrubbed.content.includes("secret@test.com"), `expected scrubbed, got: ${scrubbed.content}`);
  });

  await runTest("scrubText works", async () => {
    const vault = new PIIVault();
    vault.registerPII("email", "secret@test.com");
    const shield = new PIITransportShield(vault);
    const result = await shield.scrubText("Email: secret@test.com");
    assert(!result.includes("secret@test.com"), `expected scrubbed, got: ${result}`);
  });

  // ── SSE Restore ──
  console.log("\n=== SSE Restore (Chunk Boundary) ===\n");

  await runTest("restore handles multiple tokens", async () => {
    const vault = new PIIVault();
    const redacted = await vault.redact("Email: a@test.com and b@test.com");
    const restored = vault.restore(redacted);
    assert(restored.includes("a@test.com"), `expected first email, got: ${restored}`);
    assert(restored.includes("b@test.com"), `expected second email, got: ${restored}`);
  });

  // ── Identity Registry ──
  console.log("\n=== Identity Registry (Layer 1) ===\n");

  await runTest("singleton pattern", () => {
    IdentityRegistry.reset();
    const r1 = IdentityRegistry.getInstance();
    const r2 = IdentityRegistry.getInstance();
    assert(r1 === r2, "expected same instance");
  });

  await runTest("getExactMatches returns sorted by length", () => {
    IdentityRegistry.reset();
    const registry = IdentityRegistry.getInstance();
    const matches = registry.getExactMatches();
    for (let i = 1; i < matches.length; i++) {
      assert(
        matches[i - 1]!.literal.length >= matches[i]!.literal.length,
        `expected sorted by length, got ${matches[i - 1]!.literal} before ${matches[i]!.literal}`,
      );
    }
  });

  // ── Integration ──
  console.log("\n=== Integration: Full Redact → Restore Cycle ===\n");

  await runTest("email redaction and restoration", async () => {
    const vault = new PIIVault();
    const input = "My email is john@example.com and my SSN is 123-45-6789";
    const redacted = await vault.redact(input);
    assert(!redacted.includes("john@example.com"), `email should be redacted: ${redacted}`);
    assert(!redacted.includes("123-45-6789"), `SSN should be redacted: ${redacted}`);
    assert(redacted.includes("[CLAW_"), `should contain CLAW tokens: ${redacted}`);
    const restored = vault.restore(redacted);
    assert(restored.includes("john@example.com"), `email should be restored: ${restored}`);
    assert(restored.includes("123-45-6789"), `SSN should be restored: ${restored}`);
  });

  await runTest("structured + text PII", async () => {
    const vault = new PIIVault();
    vault.registerStructuredPII({
      from: { name: "Nimit Shah", email: "nimit@test.com" },
    });
    const text = "Got email from Nimit Shah at nimit@test.com";
    const redacted = await vault.redact(text);
    assert(!redacted.includes("Nimit Shah"), `name should be redacted: ${redacted}`);
    assert(!redacted.includes("nimit@test.com"), `email should be redacted: ${redacted}`);
    const restored = vault.restore(redacted);
    assert(restored.includes("Nimit Shah"), `name should be restored: ${restored}`);
    assert(restored.includes("nimit@test.com"), `email should be restored: ${restored}`);
  });

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runAllTests();
