import { create } from "zustand";

interface TerminalState {
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  scrollToBottom: () => void;
  setScrollToBottom: (fn: () => void) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  terminalOpen: true,
  setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
  scrollToBottom: () => {},
  setScrollToBottom: (fn) => set({ scrollToBottom: fn }),
}));
