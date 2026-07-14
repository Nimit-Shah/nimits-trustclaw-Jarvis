"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { trpc } from "~/clients/trpc";
import { useInstanceId } from "~/hooks/use-instance-id";

export function useChatHook({ initialMessages, streamId }: {
  initialMessages: UIMessage[];
  streamId: string | null;
}) {
  const [instanceId] = useInstanceId();
  const utils = trpc.useUtils();
  const seededRef = useRef(false);
  const [isSeeded, setIsSeeded] = useState(false);

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      // prepareSendMessagesRequest fires right before each HTTP POST.
      // requestMetadata is what was passed as `metadata` in sendMessage().
      // We read isVoice from it and hoist it to the top-level body field
      // so the server can parse it without any nested key lookups.
      prepareSendMessagesRequest: ({ messages, requestMetadata, body }) => ({
        body: {
          ...body,
          messages,
          // Pass the active project instanceId so the server scopes the run
          // to the correct project. The server falls back to earliest-created
          // instance when undefined.
          instanceId,
          isVoice: (requestMetadata as { isVoice?: boolean } | undefined)?.isVoice ?? false,
        },
      }),
      prepareReconnectToStreamRequest: () => ({
        api: `/api/chat?streamId=${streamId}`,
      }),
    });
  }, [streamId]);

  const chat = useChat({
    id: "chat",
    transport,
    resume: streamId !== null,
    onFinish: () => {
      void utils.nimitsJarvis.getHistory.invalidate();
    },
    onError: () => {
      void utils.nimitsJarvis.getHistory.invalidate();
    },
  });

  // Seed initial messages once on mount. Never pass `messages` as a controlled
  // prop to useChat - it resets internal state on every render, which causes a
  // scroll loop when combined with Virtuoso's followOutput during streaming.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (initialMessages.length > 0) {
      chat.setMessages(initialMessages);
    }
    setIsSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount only
  }, []);

  const sendMessageRef = useRef(chat.sendMessage);
  sendMessageRef.current = chat.sendMessage;

  // Standard text-mode send — isVoice is always false.
  const sendMessage = useCallback((text: string) => {
    void sendMessageRef.current({ text, metadata: { isVoice: false } });
  }, []);

  // Voice-mode send — isVoice is always true. Use this from useJarvisVoice.
  // Defined separately so there's no timing dependency on React state updates.
  const sendVoiceMessage = useCallback((text: string) => {
    void sendMessageRef.current({ text, metadata: { isVoice: true } });
  }, []);

  const stopRef = useRef(chat.stop);
  stopRef.current = chat.stop;

  const stableStop = useCallback(() => {
    void stopRef.current();
  }, []);

  return {
    sendMessage,
    sendVoiceMessage,
    stop: stableStop,
    // Return initialMessages until seeded to avoid flash of empty state
    messages: isSeeded ? chat.messages : initialMessages,
    status: chat.status,
    error: chat.error,
    setMessages: chat.setMessages,
  };
}
