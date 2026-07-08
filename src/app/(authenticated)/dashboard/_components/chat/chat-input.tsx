"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Square, Mic } from "lucide-react";
import type { ChatStatus } from "ai";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  status: ChatStatus;
  /** Voice mode controls injected from the parent */
  voice?: {
    whisperAvailable: boolean;
    onOpenVoiceMode: () => void;
  };
}

const MAX_MESSAGE_LENGTH = 50_000;

export function ChatInput({ onSend, onStop, status, voice }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = status === "streaming" || status === "submitted";
  const isTooLong = input.length > MAX_MESSAGE_LENGTH;
  const canSend = input.trim().length > 0 && !isStreaming && !isTooLong;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  }, [canSend, input, onSend]);

  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
      handleSubmit();
    }
  };

  const micDisabledReason = !voice?.whisperAvailable
    ? "Start the local Whisper server to use voice"
    : isStreaming
      ? "Wait for the response to finish"
      : null;

  return (
    <div className="border-border bg-background border-t p-3 md:p-4">
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        {/* Mic / Voice Mode button */}
        {voice && (
          <div className="relative" title={micDisabledReason ?? "Open voice mode (Jarvis)"}>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "size-10 shrink-0 rounded-xl transition-colors",
                voice.whisperAvailable && !isStreaming
                  ? "border-cyan-800/40 text-cyan-400 hover:border-cyan-600/60 hover:bg-cyan-950/30 hover:text-cyan-300"
                  : "cursor-not-allowed opacity-40",
              )}
              onClick={voice.whisperAvailable && !isStreaming ? voice.onOpenVoiceMode : undefined}
              disabled={!voice.whisperAvailable || isStreaming}
              aria-label={micDisabledReason ?? "Open voice mode"}
              id="voice-mode-btn"
            >
              <Mic className="size-4" />
            </Button>
            {/* Online indicator dot */}
            {voice.whisperAvailable && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-cyan-400 ring-1 ring-background" />
            )}
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming ? "Waiting for response..." : "Ask me anything..."
          }
          disabled={isStreaming}
          rows={1}
          className={cn(
            "border-border bg-muted/50 max-h-[200px] min-h-[44px] resize-none rounded-xl text-base md:text-sm",
            "placeholder:text-muted-foreground/50",
            "focus-visible:ring-ring focus-visible:ring-1",
          )}
        />

        {isStreaming ? (
          <Button
            variant="default"
            size="icon"
            className="size-10 shrink-0 rounded-xl"
            onClick={handleStop}
          >
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            className={cn(
              "size-10 shrink-0 rounded-xl",
              !canSend && "opacity-50",
            )}
            onClick={handleSubmit}
            disabled={!canSend}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      {isTooLong && (
        <p className="text-destructive text-xs">
          Message is too long ({input.length.toLocaleString()}/
          {MAX_MESSAGE_LENGTH.toLocaleString()})
        </p>
      )}
    </div>
  );
}

