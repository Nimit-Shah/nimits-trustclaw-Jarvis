"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { trpc } from "~/clients/trpc";
import { useChatHook } from "./use-chat-hook";
import type { UIMessage } from "@ai-sdk/react";
import { NimitsJarvisChatSkeleton } from "./chat/nimits-jarvis-chat.skeleton";
import { ErrorDisplay } from "~/components/core/error-display";
import { useInstanceId } from "~/hooks/use-instance-id";

type ChatContextType = ReturnType<typeof useChatHook> & {
  chatId: string;
  historyPageCount: number;
  fetchOlderMessages: () => void;
  hasOlderMessages: boolean;
  isFetchingOlderMessages: boolean;
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({
  children,
  chatId,
}: {
  children: ReactNode;
  chatId: string;
}) {
  const [instanceId] = useInstanceId();

  const historyQuery = trpc.nimitsJarvis.getHistory.useInfiniteQuery(
    { limit: 10, instanceId, chatId },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const streamingQuery = trpc.nimitsJarvis.getStreamingMessage.useQuery(
    { instanceId, chatId },
    {
      refetchOnWindowFocus: "always",
    },
  );

  if (historyQuery.error || streamingQuery.error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8">
        <ErrorDisplay
          message="Failed to load chat history"
          retryText="Retry"
          onRetry={() => {
            void historyQuery.refetch();
            void streamingQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!historyQuery.data || streamingQuery.isLoading) {
    return (
      <div className="flex h-full w-full flex-col">
        <NimitsJarvisChatSkeleton />
      </div>
    );
  }

  const pages = historyQuery.data.pages;
  const allHistoryMessages = [...pages].reverse().flatMap((p) => p.messages);

  const initialMessages: UIMessage[] = allHistoryMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    parts: msg.content as UIMessage["parts"],
  }));

  const streamId = streamingQuery.data?.messageId ?? null;

  return (
    <InnerChatProvider
      initialMessages={initialMessages}
      streamId={streamId}
      historyPageCount={pages.length}
      fetchOlderMessages={() => void historyQuery.fetchNextPage()}
      hasOlderMessages={historyQuery.hasNextPage ?? false}
      isFetchingOlderMessages={historyQuery.isFetchingNextPage}
      chatId={chatId}
    >
      {children}
    </InnerChatProvider>
  );
}

function InnerChatProvider({
  children,
  initialMessages,
  streamId,
  historyPageCount,
  fetchOlderMessages,
  hasOlderMessages,
  isFetchingOlderMessages,
  chatId,
}: {
  children: ReactNode;
  initialMessages: UIMessage[];
  streamId: string | null;
  historyPageCount: number;
  fetchOlderMessages: () => void;
  hasOlderMessages: boolean;
  isFetchingOlderMessages: boolean;
  chatId: string;
}) {
  const chatHook = useChatHook({ initialMessages, streamId, chatId });

  const pageCountRef = useRef(historyPageCount);
  useEffect(() => {
    if (historyPageCount <= pageCountRef.current) {
      pageCountRef.current = historyPageCount;
      return;
    }
    chatHook.setMessages((current) => {
      const currentIds = new Set(current.map((m) => m.id));
      const newOlder = initialMessages.filter((m) => !currentIds.has(m.id));
      if (newOlder.length === 0) return current;
      return [...newOlder, ...current];
    });
    pageCountRef.current = historyPageCount;
  }, [historyPageCount, initialMessages, chatHook.setMessages]);

  return (
    <ChatContext.Provider
      value={{
        ...chatHook,
        chatId,
        historyPageCount,
        fetchOlderMessages,
        hasOlderMessages,
        isFetchingOlderMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}
