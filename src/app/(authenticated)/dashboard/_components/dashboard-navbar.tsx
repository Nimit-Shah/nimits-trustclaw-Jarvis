"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  LogOut,
  MessageCircle,
  PanelRight,
  Puzzle,
  Settings,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ThemeToggle } from "~/components/core/theme-toggle";
import { NimitsJarvisBrand } from "~/app/_components/nimits-jarvis-brand";
import { authClient } from "~/clients/auth/react";
import { useTerminalStore } from "./terminal-store";
import { ProjectSelector } from "./project-selector";

export function DashboardNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isChat = pathname === "/dashboard";
  const isSettings = pathname.startsWith("/dashboard/settings");
  const isToolkits = pathname.startsWith("/dashboard/toolkits");
  const terminalOpen = useTerminalStore((s) => s.terminalOpen);
  const setTerminalOpen = useTerminalStore((s) => s.setTerminalOpen);
  const router = useRouter();

  const instanceParam = searchParams.get("instance");
  const chatParam = searchParams.get("chat");
  const qsParts: string[] = [];
  if (instanceParam) qsParts.push(`instance=${instanceParam}`);
  const instanceQs = qsParts.length > 0 ? `?${qsParts.join("&")}` : "";
  const chatQsParts = [...qsParts];
  if (chatParam) chatQsParts.push(`chat=${chatParam}`);
  const chatQs = chatQsParts.length > 0 ? `?${chatQsParts.join("&")}` : "";
  const handleToggleTerminal = () => {
    setTerminalOpen(!terminalOpen);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <header className="border-border bg-background/95 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <NimitsJarvisBrand size="sm" logoLink="/dashboard" />
        <div className="hidden sm:block">
          <ProjectSelector />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`/dashboard${chatQs}`}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${isChat ? "bg-accent" : ""}`}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`/dashboard/toolkits${instanceQs}`}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${isToolkits ? "bg-accent" : ""}`}
              >
                <Puzzle className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Toolkits</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`/dashboard/settings${instanceQs}`}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${isSettings ? "bg-accent" : ""}`}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        {isChat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`hidden h-9 w-9 md:inline-flex ${terminalOpen ? "bg-accent" : ""}`}
                onClick={handleToggleTerminal}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {terminalOpen ? "Hide" : "Show"} Terminal
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <ThemeToggle />
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleLogout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Logout</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
