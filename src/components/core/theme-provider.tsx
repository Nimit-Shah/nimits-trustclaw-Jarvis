"use client";

import React, { type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// React 19 JSX strict types don't allow `children` as JSX nodes for components
// typed as plain function `(props: P) => JSX.Element` unless P is marked FC.
// next-themes 0.4.6 uses that pattern, so we bypass JSX and use createElement.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return React.createElement(
    NextThemesProvider,
    {
      attribute: "class",
      defaultTheme: "dark",
      enableSystem: false,
      disableTransitionOnChange: true,
    },
    children,
  );
}
