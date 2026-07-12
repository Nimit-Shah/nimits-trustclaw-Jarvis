import { smoothStream, UI_MESSAGE_STREAM_HEADERS } from "ai";
import { z } from "zod";
import { auth } from "~/server/auth";
import { db } from "~/server/clients/db";
import { prepareAgentRun } from "~/server/api/routers/nimits-jarvis/agent/setup";
import type { PIIVault } from "~/server/api/routers/nimits-jarvis/agent/pii";
import {
  setStreamingMessage,
  getStreamingMessage,
} from "~/server/clients/redis";
import { rateLimit } from "~/server/clients/rate-limit";
import { getStreamContext } from "./stream-store";
import { TRPCError } from "@trpc/server";

const chatRequestBody = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().optional(),
      parts: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  ),
  // Injected by prepareSendMessagesRequest in use-chat-hook.ts for voice requests
  isVoice: z.boolean().optional(),
});

async function getAuthenticatedInstance(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const userId = session.user.id;
  const instance = await db.composioClawInstance.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  });

  if (!instance) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return { userId, instanceId: instance.id };
}

/**
 * Creates a TransformStream that intercepts outbound SSE chunks and
 * restores PII tokens (e.g. `[EMAIL_1]`) back to original values
 * using the provided vault.
 *
 * Works on raw Uint8Array chunks — decodes to text, applies restoration,
 * then re-encodes. This is safe because SSE is UTF-8 text.
 */
function createPIIRestoreTransform(
  vault: PIIVault,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      const restored = vault.restore(text);
      controller.enqueue(encoder.encode(restored));
    },
    flush(controller) {
      // Flush any remaining decoder state
      const remaining = decoder.decode();
      if (remaining) {
        controller.enqueue(encoder.encode(vault.restore(remaining)));
      }
    },
  });
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const authResult = await getAuthenticatedInstance(request);
  if (!authResult) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { instanceId, userId } = authResult;

  const body = chatRequestBody.safeParse(await request.json());
  if (!body.success) {
    return new Response("Invalid request body", { status: 400 });
  }

  const lastUserMessage = [...body.data.messages]
    .reverse()
    .find((m) => m.role === "user");
  const userText =
    lastUserMessage?.parts
      ?.filter(
        (p): p is { type: string; text: string } =>
          typeof p === "object" &&
          p !== null &&
          "type" in p &&
          p.type === "text" &&
          "text" in p &&
          typeof p.text === "string",
      )
      .map((p) => p.text)
      .join("\n") ?? "";
  if (!userText.trim()) {
    return new Response("Empty message", { status: 400 });
  }

  const limit = await rateLimit(userId, "chat");
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(limit.retryAfterSeconds),
      },
    });
  }

  // E2E verification log — remove after confirming voice flag flows end-to-end
  console.log(`[chat/route] isVoice=${String(body.data.isVoice ?? false)}`);

  const prepareResult = await prepareAgentRun({
    instanceId,
    userMessage: userText,
    source: "web",
    isVoice: body.data.isVoice ?? false,
  });

  const { agent, messages, piiVault } = prepareResult.result;

  const streamId = crypto.randomUUID();
  await setStreamingMessage(instanceId, streamId);

  // agent.stream() returns streamText() result - supports toUIMessageStreamResponse
  // Pass request.signal so the agent stops when the client disconnects (stop button)
  const result = await agent.stream({
    prompt: messages,
    experimental_transform: smoothStream(),
    abortSignal: request.signal,
  });

  const streamContext = getStreamContext();
  const response = result.toUIMessageStreamResponse({
    headers: {
      "X-Stream-Id": streamId,
    },
    ...(streamContext
      ? {
          consumeSseStream: ({ stream }) => {
            void streamContext.createNewResumableStream(
              streamId,
              () => stream,
            );
          },
        }
      : {}),
  });

  // When PII redaction is active, wrap the response body with a
  // transform that restores PII tokens back to original values.
  // The SSE stream contains text like "[EMAIL_1] sent you a message"
  // which we rewrite to "john@example.com sent you a message".
  if (piiVault?.hasRedactions && response.body) {
    const restored = response.body.pipeThrough(
      createPIIRestoreTransform(piiVault),
    );
    return new Response(restored, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
}

export async function GET(request: Request) {
  const authResult = await getAuthenticatedInstance(request);

  const { instanceId } = authResult;
  const url = new URL(request.url);
  const streamId = url.searchParams.get("streamId");

  if (!streamId) {
    return new Response("Missing streamId", { status: 400 });
  }

  const activeStreamId = await getStreamingMessage(instanceId);
  if (activeStreamId !== streamId) {
    return new Response("Stream not found or not yours", { status: 404 });
  }

  const streamContext = getStreamContext();
  if (!streamContext) {
    return new Response("Stream resumption not available", { status: 204 });
  }
  const stream = await streamContext.resumeExistingStream(streamId);
  if (!stream) {
    return new Response("Stream already completed", { status: 204 });
  }

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}
