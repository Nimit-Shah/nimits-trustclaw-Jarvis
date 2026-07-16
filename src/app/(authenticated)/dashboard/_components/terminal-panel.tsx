"use client";

import { useTerminalStore } from "./terminal-store";
import { useChatContext } from "./chat-context";
import { TerminalPane } from "./terminal/terminal-pane";

export function TerminalPanel() {
  const terminalOpen = useTerminalStore((s) => s.terminalOpen);
  const setTerminalOpen = useTerminalStore((s) => s.setTerminalOpen);

  // ChatContext may not be available (e.g. on settings/toolkits pages)
  let messages: import("@ai-sdk/react").UIMessage[] = [];
  let status: import("ai").ChatStatus = "ready";
  try {
    const ctx = useChatContext();
    messages = ctx.messages;
    status = ctx.status;
  } catch {
    // Not in chat context — render empty terminal
  }

  if (!terminalOpen) return null;

  return (
    <div className="w-[380px] shrink-0 border-l border-border hidden md:block overflow-hidden">
      <TerminalPane
        messages={messages}
        status={status}
        onHide={() => setTerminalOpen(false)}
      />
    </div>
  );
}