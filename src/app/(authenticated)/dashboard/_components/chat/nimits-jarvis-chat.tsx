"use client";

import { useEffect, useState, useRef } from "react";
import { trpc } from "~/clients/trpc";
import { useChatId } from "~/hooks/use-chat-id";
import { useInstanceId } from "~/hooks/use-instance-id";
import { ChatProvider } from "../chat-context";
import { ChatView } from "./chat-view";
import { NimitsJarvisChatSkeleton } from "./nimits-jarvis-chat.skeleton";

function ChatWithProvider({ chatId }: { chatId: string }) {
  const [instanceId] = useInstanceId();
  const utils = trpc.useUtils();
  const { data: chats } = trpc.chats.list.useQuery(
    { instanceId },
  );
  const renameChat = trpc.chats.rename.useMutation({
    onSuccess: () => {
      void utils.chats.list.invalidate();
    },
  });

  const autoNamedRef = useRef(false);
  const chat = chats?.find((c) => c.id === chatId);

  useEffect(() => {
    if (autoNamedRef.current || !chat || chat.name !== "New Chat") return;

    autoNamedRef.current = true;
    const timer = setTimeout(() => {
      const firstUserMsg = document.querySelector('[data-role="user"]');
      if (firstUserMsg) {
        const text = firstUserMsg.textContent ?? "";
        const name = text.length > 40 ? text.slice(0, 40) + "..." : text;
        if (name.trim() && name.trim() !== "New Chat") {
          void renameChat.mutateAsync({ chatId, name });
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [chat, chatId, renameChat]);

  return (
    <ChatProvider chatId={chatId}>
      <ChatView />
    </ChatProvider>
  );
}

export function NimitsJarvisChat() {
  const [instanceId] = useInstanceId();
  const [urlChatId, setChatId] = useChatId();
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  const { data: chats } = trpc.chats.list.useQuery(
    { instanceId },
    { staleTime: 30_000 },
  );

  const prevChatsLengthRef = useRef(0);

  useEffect(() => {
    if (!chats || chats.length === 0) return;

    const currentLength = chats.length;
    const justLoaded = prevChatsLengthRef.current === 0 && currentLength > 0;
    prevChatsLengthRef.current = currentLength;

    if (urlChatId && chats.some((c) => c.id === urlChatId)) {
      setResolvedId(urlChatId);
      return;
    }

    if (!urlChatId || justLoaded) {
      const first = chats[0]!;
      setChatId(first.id);
      setResolvedId(first.id);
    }
  }, [chats, urlChatId, setChatId]);

  if (!resolvedId) {
    return <NimitsJarvisChatSkeleton />;
  }

  return <ChatWithProvider key={resolvedId} chatId={resolvedId} />;
}