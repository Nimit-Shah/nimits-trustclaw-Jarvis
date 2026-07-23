/**
 * DeBERTa PII Classifier — Hugging Face token classification for
 * detecting unstructured PII (names, addresses, locations) in free text.
 *
 * Model: Isotonic/deberta-v3-base_finetuned_ai4privacy_v2
 * Runtime: ONNX via @huggingface/transformers (no PyTorch/Python required)
 *
 * This is Layer 3 of the PII pipeline: ML-based, 10-30ms latency.
 * Falls back gracefully if the model fails to load.
 *
 * Usage:
 *   const results = await classifyPII("My name is Nimit Shah");
 *   // results: [{ value: "Nimit Shah", category: "NAME", start: 11, end: 21, score: 0.95 }]
 */

import { createHash } from "crypto";
import type { PIIType } from "./pii-types";

export interface ClassificationResult {
  value: string;
  category: PIIType;
  start: number;
  end: number;
  score: number;
}

// Map DeBERTa entity labels to our PIIType
const LABEL_TO_PII_TYPE: Record<string, PIIType> = {
  PERSON: "person_name",
  NAME: "person_name",
  EMAIL: "email",
  PHONE: "phone",
  ADDRESS: "address",
  LOCATION: "address",
  SSN: "ssn",
  CREDIT_CARD: "credit_card",
  IP_ADDRESS: "ip_address",
  API_KEY: "api_key",
};

const CONFIDENCE_THRESHOLD = 0.80;
const MIN_TEXT_LENGTH = 10;

let classifierInstance: any = null;
let loadAttempted = false;
let loadFailed = false;

/**
 * Lazy-load the DeBERTa model. Caches the instance after first load.
 * Falls back gracefully if model download fails.
 */
async function getClassifier(): Promise<any | null> {
  if (classifierInstance) return classifierInstance;
  if (loadFailed) return null;

  loadAttempted = true;
  try {
    const { pipeline, env } = await import("@huggingface/transformers");

    // Configure local cache directory
    env.allowRemoteModels = true;
    env.localModelPath = "./.models_cache";

    classifierInstance = await pipeline(
      "token-classification",
      "Isotonic/deberta-v3-base_finetuned_ai4privacy_v2",
    );

    console.log("[DeBERTa] Model loaded successfully");
    return classifierInstance;
  } catch (err) {
    console.warn(
      "[DeBERTa] Failed to load model. Falling back to regex-only PII detection.",
      err,
    );
    loadFailed = true;
    return null;
  }
}

/**
 * Classify PII entities in text using DeBERTa token classification.
 * Returns an array of detected PII entities with positions and confidence scores.
 * Returns empty array if model is unavailable or text is too short.
 */
export async function classifyPII(
  text: string,
): Promise<ClassificationResult[]> {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) return [];

  const classifier = await getClassifier();
  if (!classifier) return [];

  try {
    const entities = await classifier(text, { aggregation_strategy: "simple" });

    if (!entities || !Array.isArray(entities)) return [];

    const results: ClassificationResult[] = [];

    for (const entity of entities) {
      if (entity.score < CONFIDENCE_THRESHOLD) continue;

      const rawSpan = text.slice(entity.start, entity.end);
      // Skip if already tokenized (looks like a PII token)
      if (rawSpan.startsWith("[CLAW_")) continue;

      const label = (
        entity.entity_group ||
        entity.entity ||
        "PII"
      ).toUpperCase();
      const piiType = LABEL_TO_PII_TYPE[label] ?? "person_name";

      results.push({
        value: rawSpan.trim(),
        category: piiType,
        start: entity.start,
        end: entity.end,
        score: entity.score,
      });
    }

    return results;
  } catch (err) {
    console.warn("[DeBERTa] Classification error:", err);
    return [];
  }
}

/**
 * Check if DeBERTa model is available (loaded successfully).
 */
export function isDeBERTaAvailable(): boolean {
  return classifierInstance !== null && !loadFailed;
}

/**
 * Pre-warm the model (call early to avoid cold start on first request).
 * Non-blocking — fires and forgets.
 */
export function prewarmDeBERTa(): void {
  if (!loadAttempted && !loadFailed) {
    void getClassifier();
  }
}
