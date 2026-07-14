// Adapted from pi-mono: packages/coding-agent/src/core/compaction/compaction.ts:376-438 (cut point algorithm)
// Adaptive chunking / staged summarization from openclaw: src/agents/compaction.ts:110-129, 244-305
// Fallback chain from openclaw: src/agents/compaction.ts:176-242
import { generateText } from "ai";
import { ollamaProvider } from "~/server/clients/ollama";
import { db } from "~/server/clients/db";
import type { ReconstructedMessage } from "../types";
import { estimateMessageTokens } from "../context/token-estimation";
import {
  COMPACTION_SYSTEM_PROMPT,
  INITIAL_SUMMARIZATION_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
  MERGE_SUMMARIES_PROMPT,
  serializeMessages,
  buildToolFailuresSuffix,
} from "./prompts";
import { sanitizeString } from "../context/build-context";
import { getModelProvider, resolveModelId } from "../model-utils";
import { PIIVault } from "../pii";

interface CompactionParams {
  instanceId: string;
  anthropicModel: string;
  messages: ReconstructedMessage[];
  keepRecentTokens: number;
  previousSummary: string | null;
  compactionCount: number;
  compactionAttempts: number;
}

interface CompactionResult {
  summary: string;
  keptMessageCount: number;
  compactedMessageCount: number;
}

const ADAPTIVE_CHUNK_THRESHOLD = 100_000;
const LARGE_TOOL_RESULT_THRESHOLD = 10_000;
const MAX_COMPACTION_ATTEMPTS = 3;

export function findCutPoint(
  messages: ReconstructedMessage[],
  keepRecentTokens: number,
): number {
  if (messages.length <= 2) return 0;

  let accumulatedTokens = 0;
  let foundCut = false;
  let rawCutIndex = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    accumulatedTokens += estimateMessageTokens(messages[i]!);
    if (accumulatedTokens >= keepRecentTokens) {
      rawCutIndex = i;
      foundCut = true;
      break;
    }
  }

  if (!foundCut) return 0;

  for (let i = rawCutIndex; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg.role === "user" || msg.role === "assistant") {
      return i;
    }
  }

  return 0;
}

async function summarize(
  anthropicModel: string,
  conversationText: string,
  previousSummary: string | null,
): Promise<string> {
  const provider = getModelProvider(anthropicModel);
  const model = provider === "ollama"
    ? ollamaProvider(anthropicModel)
    : resolveModelId(anthropicModel);

  // Redact PII before sending to external LLMs.
  // Local Ollama models are exempt since data stays on-device.
  const vault = provider !== "ollama" ? new PIIVault() : null;

  const safeConversation = sanitizeString(conversationText);
  const safePreviousSummary = previousSummary ? sanitizeString(previousSummary) : null;

  const redactedConversation = vault ? vault.redact(safeConversation) : safeConversation;
  const redactedPreviousSummary = vault && safePreviousSummary
    ? vault.redact(safePreviousSummary)
    : safePreviousSummary;

  let prompt: string;
  if (redactedPreviousSummary) {
    prompt = `<conversation>\n${redactedConversation}\n</conversation>\n\n<previous-summary>\n${redactedPreviousSummary}\n</previous-summary>\n\n${UPDATE_SUMMARIZATION_PROMPT}`;
  } else {
    prompt = `<conversation>\n${redactedConversation}\n</conversation>\n\n${INITIAL_SUMMARIZATION_PROMPT}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const result = await generateText({
      model,
      system: COMPACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 4_000,
      abortSignal: controller.signal,
    });

    // Restore PII in the summary before persisting to the database
    return vault ? vault.restore(result.text) : result.text;
  } finally {
    clearTimeout(timeout);
  }
}

async function stagedSummarize(
  anthropicModel: string,
  messages: ReconstructedMessage[],
  previousSummary: string | null,
): Promise<string> {
  const midpoint = Math.floor(messages.length / 2);
  const firstHalf = messages.slice(0, midpoint);
  const secondHalf = messages.slice(midpoint);

  const firstText = serializeMessages(firstHalf);
  const secondText = serializeMessages(secondHalf);

  const firstSummary = await summarize(
    anthropicModel,
    firstText,
    previousSummary,
  );

  const secondSummary = await summarize(
    anthropicModel,
    secondText,
    firstSummary,
  );

  const mergeProvider = getModelProvider(anthropicModel);
  const mergeModel = mergeProvider === "ollama"
    ? ollamaProvider(anthropicModel)
    : resolveModelId(anthropicModel);

  // Redact PII before the merge call. firstSummary and secondSummary were
  // already restored by their individual summarize() calls, so they contain
  // real PII values that must be redacted before reaching an external merge LLM.
  const mergeVault = mergeProvider !== "ollama" ? new PIIVault() : null;
  const mergeContent = `<summary-1>\n${firstSummary}\n</summary-1>\n\n<summary-2>\n${secondSummary}\n</summary-2>\n\n${MERGE_SUMMARIES_PROMPT}`;
  const safeMergeContent = mergeVault ? mergeVault.redact(mergeContent) : mergeContent;

  const mergeController = new AbortController();
  const mergeTimeout = setTimeout(() => mergeController.abort(), 30_000);

  try {
    const mergeResult = await generateText({
      model: mergeModel,
      system: COMPACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: safeMergeContent }],
      maxOutputTokens: 4_000,
      abortSignal: mergeController.signal,
    });

    return mergeVault ? mergeVault.restore(mergeResult.text) : mergeResult.text;
  } finally {
    clearTimeout(mergeTimeout);
  }
}

function stripLargeToolResults(
  messages: ReconstructedMessage[],
): ReconstructedMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    return {
      ...msg,
      content: msg.content.map((part) => {
        const outputStr = JSON.stringify(part.output);
        if (outputStr.length > LARGE_TOOL_RESULT_THRESHOLD) {
          return { ...part, output: { type: "text" as const, value: "[Large tool result omitted]" } };
        }
        return part;
      }),
    };
  });
}

export async function runCompaction(
  params: CompactionParams,
): Promise<CompactionResult | null> {
  const { instanceId, anthropicModel, messages, keepRecentTokens, previousSummary, compactionCount, compactionAttempts } = params;

  // If compaction has failed multiple times in a row, skip this cycle
  // to avoid wasting tokens on a persistent failure (e.g., context too large
  // for the model, corrupted data). The counter resets on the next successful
  // compaction or when the user manually triggers it.
  if (compactionAttempts >= MAX_COMPACTION_ATTEMPTS) {
    console.warn("[compaction] skipped: max attempts reached", { compactionAttempts });
    return null;
  }

  const cutIndex = findCutPoint(messages, keepRecentTokens);
  if (cutIndex <= 0) return null;

  const messagesToCompact = messages.slice(0, cutIndex);
  const keptMessageCount = messages.length - cutIndex;

  let summary: string;
  let llmFailed = false;

  try {
    const conversationText = serializeMessages(messagesToCompact);

    if (conversationText.length > ADAPTIVE_CHUNK_THRESHOLD) {
      summary = await stagedSummarize(
        anthropicModel,
        messagesToCompact,
        previousSummary,
      );
    } else {
      summary = await summarize(
        anthropicModel,
        conversationText,
        previousSummary,
      );
    }
  } catch (error) {
    console.warn("[compaction] summarize failed, retrying without large tool results:", error);
    llmFailed = true;
    try {
      const stripped = stripLargeToolResults(messagesToCompact);
      const strippedText = serializeMessages(stripped);
      summary = await summarize(
        anthropicModel,
        strippedText,
        previousSummary,
      );
      llmFailed = false;
    } catch (innerError) {
      console.warn("[compaction] stripped summarize also failed:", innerError);
      summary = `Conversation covered ${messagesToCompact.length} messages. Summary unavailable due to context limits.`;
    }
  }

  const failuresSuffix = buildToolFailuresSuffix(messagesToCompact);
  if (failuresSuffix) {
    summary += failuresSuffix;
  }

  const estimatedTokens = Math.ceil(summary.length / 4);

  try {
    await db.composioClawInstance.update({
      where: { id: instanceId, compactionCount },
      data: {
        lastCompactionSummary: summary,
        compactionCount: { increment: 1 },
        compactionAttempts: 0,
        lastCompactionAt: new Date(),
        tokensAtCompaction: estimatedTokens,
      },
    });
  } catch {
    // Optimistic lock failure — another compaction ran first, or a transient
    // DB error. Increment attempts to prevent rapid retry loops.
    await db.composioClawInstance
      .update({
        where: { id: instanceId },
        data: { compactionAttempts: { increment: 1 } },
      })
      .catch(() => {});
    console.warn("[compaction] DB update failed (optimistic lock or transient error)");
    return null;
  }

  // If the LLM calls failed but we still produced a fallback summary,
  // increment attempts so we don't keep retrying with a broken model.
  if (llmFailed) {
    await db.composioClawInstance
      .update({
        where: { id: instanceId },
        data: { compactionAttempts: { increment: 1 } },
      })
      .catch(() => {});
  }

  return {
    summary,
    keptMessageCount,
    compactedMessageCount: cutIndex,
  };
}
