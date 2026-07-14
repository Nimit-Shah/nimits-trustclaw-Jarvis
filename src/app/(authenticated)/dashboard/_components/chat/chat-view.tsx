"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import type { VirtuosoHandle } from "react-virtuoso";
import type { UIMessage } from "@ai-sdk/react";
import { Loader2, ArrowDown } from "lucide-react";
import { ErrorBoundary } from "~/components/core/error-boundary";
import { Button } from "~/components/ui/button";
import { useTerminalStore } from "../terminal-store";
import { useChatContext } from "../chat-context";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message/assistant-message";
import { ThinkingIndicator } from "./assistant-message/thinking-indicator";
import { ChatInput } from "./chat-input";
import { TerminalPane } from "../terminal/terminal-pane";
import { useJarvisVoice } from "./use-jarvis-voice";
import { VoiceModeOverlay } from "./voice-mode-overlay";

const SAMPLE_PROMPTS = [
  "Summarize my emails for today",
  "What's on my calendar for tomorrow",
  "Catch me up on latest messages on Slack",
];

const START_INDEX = 100_000;

export function ChatView() {
  const { 
    sendMessage, 
    sendVoiceMessage, 
    stop, 
    messages, 
    status, 
    setMessages,
    historyPageCount,
    fetchOlderMessages,
    hasOlderMessages,
    isFetchingOlderMessages
  } = useChatContext();
  const terminalOpen = useTerminalStore((s) => s.terminalOpen);
  const setTerminalOpen = useTerminalStore((s) => s.setTerminalOpen);
  const isEmpty = messages.length === 0;

  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);

  const prevMessageCountRef = useRef(messages.length);
  const prevFirstIdRef = useRef<string | null>(null);

  // Track prepended older messages by comparing first-item identity and
  // count delta. Must be in useEffect (not render) to avoid state updates
  // during the render phase, which is a React anti-pattern.
  useEffect(() => {
    if (messages.length === 0) return;

    const currentFirstId = messages[0]!.id;
    const countDelta = messages.length - prevMessageCountRef.current;

    if (countDelta > 0 && prevFirstIdRef.current !== null && currentFirstId !== prevFirstIdRef.current) {
      setFirstItemIndex((prev) => prev - countDelta);
    }

    prevMessageCountRef.current = messages.length;
    prevFirstIdRef.current = currentFirstId;
  }, [messages]);

  // ── handleSend (text mode) — must be declared BEFORE useJarvisVoice ──
  const handleSend = useCallback(
    (text: string) => {
      const result = sendMessage(text);
      // Wait one frame for Virtuoso to render the new user message
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "start",
          behavior: "smooth",
        });
      });
      return result;
    },
    [sendMessage],
  );

  // ── handleVoiceSend — always passes isVoice:true via sendVoiceMessage ──
  const handleVoiceSend = useCallback(
    (text: string) => {
      const result = sendVoiceMessage(text);
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "start",
          behavior: "smooth",
        });
      });
      return result;
    },
    [sendVoiceMessage],
  );

      // We can't access initialMessages here anymore, but we can just let context handle history!
      // Wait, history fetching in context adds to the hook internally...
      // No, wait, context ONLY passes the hook down. The hook doesn't know about older messages.
      // If we prepend new older messages, we need them...
      // Let's just remove the history prepend logic from ChatView for a moment, or rather:
      // We should actually move this useEffect INTO useChatHook or InnerChatProvider if we want it to work correctly,
      // because initialMessages is not available here.
      // Ah! InnerChatProvider has initialMessages.
      // Let me just delete this useEffect block here and we will move it to InnerChatProvider.

  const handleStartReached = useCallback(() => {
    if (hasOlderMessages && !isFetchingOlderMessages) {
      void fetchOlderMessages();
    }
  }, [hasOlderMessages, isFetchingOlderMessages, fetchOlderMessages]);

  const isStreaming = status === "streaming" || status === "submitted";
  const lastMessage = messages[messages.length - 1];
  const isWaitingForAssistant = isStreaming && lastMessage?.role === "user";

  // Derive latest assistant text for TTS — UIMessage uses .parts, not .content
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const latestAssistantText = lastAssistantMessage
    ? lastAssistantMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("")
    : undefined;
  const latestAssistantMessageId = lastAssistantMessage?.id;

  const jarvis = useJarvisVoice({
    onSend: handleVoiceSend,
    isAgentStreaming: isStreaming,
    latestAssistantText,
    latestAssistantMessageId,
  });


  const handleScrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "smooth",
    });
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">


        <div className="relative min-h-0 flex-1">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      void handleSend(prompt);
                    }}
                    className="border-border text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-4 py-2 text-sm transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              firstItemIndex={firstItemIndex}
              initialTopMostItemIndex={{ index: "LAST", align: "end" }}
              startReached={handleStartReached}
              atBottomStateChange={setAtBottom}
              atBottomThreshold={50}
              increaseViewportBy={{ top: 200, bottom: 0 }}
              components={{
                Header: () =>
                  isFetchingOlderMessages ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : null,
                Footer: () => (
                  <div className="pb-4 md:pb-6">
                    {isWaitingForAssistant && (
                      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-8">
                        <ThinkingIndicator />
                      </div>
                    )}
                  </div>
                ),
              }}
              itemContent={(_index, message) =>
                message.role === "user" ? (
                  <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-8">
                    <ErrorBoundary
                      key={message.id}
                      fallback={
                        <p className="text-muted-foreground text-sm italic">
                          Failed to render message
                        </p>
                      }
                    >
                      <UserMessage message={message} />
                    </ErrorBoundary>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-8">
                    <ErrorBoundary
                      key={message.id}
                      fallback={
                        <p className="text-muted-foreground text-sm italic">
                          Failed to render message
                        </p>
                      }
                    >
                      <AssistantMessage
                        message={message}
                        status={message.id === lastMessage?.id ? status : "ready"}
                        onOpenTerminal={() => setTerminalOpen(true)}
                      />
                    </ErrorBoundary>
                  </div>
                )
              }
              className="!overflow-y-auto"
            />
          )}

          {!atBottom && !isEmpty && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleScrollToBottom}
              className="absolute bottom-4 left-1/2 size-10 -translate-x-1/2 rounded-full shadow-md"
            >
              <ArrowDown className="size-4" />
            </Button>
          )}
        </div>

        <ChatInput
          onSend={handleSend}
          onStop={stop}
          status={status}
          voice={{
            whisperAvailable: jarvis.whisperAvailable,
            onOpenVoiceMode: jarvis.openVoiceMode,
          }}
        />
      </div>

      {/* Jarvis Voice Mode Overlay */}
      <VoiceModeOverlay
        isOpen={jarvis.isVoiceModeOpen}
        jarvisState={jarvis.jarvisState}
        micPermission={jarvis.micPermission}
        volume={jarvis.volume}
        lastTranscription={jarvis.lastTranscription}
        error={jarvis.voiceError}
        onClose={jarvis.closeVoiceMode}
        onRequestMicPermission={jarvis.requestMicPermission}
      />

      {terminalOpen && (
        <div className="hidden w-[400px] shrink-0 border-l border-border md:block lg:w-[500px]">
          <TerminalPane messages={messages} status={status} onHide={() => setTerminalOpen(false)} />
        </div>
      )}
    </div>
  );
}
