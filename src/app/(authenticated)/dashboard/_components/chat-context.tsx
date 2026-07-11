"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { trpc } from "~/clients/trpc";
import { useChatHook } from "./use-chat-hook";
import type { UIMessage } from "@ai-sdk/react";
import { TrustClawChatSkeleton } from "./chat/trustclaw-chat.skeleton";

type ChatContextType = ReturnType<typeof useChatHook> & {
  historyPageCount: number;
  fetchOlderMessages: () => void;
  hasOlderMessages: boolean;
  isFetchingOlderMessages: boolean;
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const historyQuery = trpc.trustclaw.getHistory.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const streamingQuery = trpc.trustclaw.getStreamingMessage.useQuery(
    undefined,
    {
      refetchOnWindowFocus: "always",
    },
  );

  if (!historyQuery.data || streamingQuery.isLoading) {
    // Only shows on initial hard load. Client navigations keep data cached.
    return (
      <div className="flex h-full w-full flex-col">
        <TrustClawChatSkeleton />
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
}: {
  children: ReactNode;
  initialMessages: UIMessage[];
  streamId: string | null;
  historyPageCount: number;
  fetchOlderMessages: () => void;
  hasOlderMessages: boolean;
  isFetchingOlderMessages: boolean;
}) {
  const chatHook = useChatHook({ initialMessages, streamId });

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
