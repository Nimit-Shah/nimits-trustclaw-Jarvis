import "server-only";
import { env } from "~/env";

// ─── AES-256-GCM encryption for at-rest secrets ─────────────────────────────
// Used to encrypt per-project Composio API keys before storing in the DB.
// The ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
//
// Generate with: openssl rand -hex 32

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getKey(): Promise<CryptoKey> {
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32"
    );
  }
  const keyBuffer = hexToBuffer(env.ENCRYPTION_KEY);
  return crypto.subtle.importKey("raw", keyBuffer, { name: ALGORITHM, length: KEY_LENGTH }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string in the format `<iv>:<ciphertext+tag>`.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );
  return `${bufferToHex(iv.buffer)}:${bufferToHex(encrypted)}`;
}

/**
 * Decrypts a hex-encoded string produced by `encrypt`.
 * Returns the original plaintext.
 */
export async function decrypt(ciphertext: string): Promise<string> {
  const [ivHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !dataHex) throw new Error("Invalid encrypted value format");

  const key = await getKey();
  const iv = new Uint8Array(hexToBuffer(ivHex));
  const data = hexToBuffer(dataHex);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Returns true if the given string looks like it was encrypted by `encrypt`.
 * Does not verify the ciphertext is valid — only checks the format.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 2) return false;
  const [ivHex, dataHex] = parts;
  return (
    !!ivHex &&
    !!dataHex &&
    ivHex.length === IV_BYTES * 2 &&
    // tag alone is TAG_BYTES * 2 = 32 hex chars, so ciphertext must be longer
    dataHex.length >= TAG_BYTES * 2 * 2
  );
}
