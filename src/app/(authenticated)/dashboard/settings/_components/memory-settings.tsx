"use client";

import { Brain, User, Briefcase, Phone, Settings2, RefreshCw } from "lucide-react";
import moment from "moment";
import { trpc } from "~/clients/trpc";
import { useInstanceId } from "~/hooks/use-instance-id";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface ProfileItem {
  key: string;
  category: string;
  label: string;
  value: string;
  importance: number;
  updated_at: string;
}

const CATEGORY_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  identity: { icon: User, label: "Identity", color: "text-violet-400 bg-violet-950/30 border-violet-500/30" },
  contact: { icon: Phone, label: "Contact", color: "text-teal-400 bg-teal-950/30 border-teal-500/30" },
  work: { icon: Briefcase, label: "Work", color: "text-blue-400 bg-blue-950/30 border-blue-500/30" },
  preferences: { icon: Settings2, label: "Preferences", color: "text-amber-400 bg-amber-950/30 border-amber-500/30" },
};

function ProfileCategory({
  category,
  items,
}: {
  category: string;
  items: ProfileItem[];
}) {
  const meta = CATEGORY_META[category] ?? {
    icon: Brain,
    label: category.charAt(0).toUpperCase() + category.slice(1),
    color: "text-muted-foreground bg-muted border-border",
  };
  const Icon = meta.icon;

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", meta.color.split(" ").slice(1).join(" "))}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", meta.color.split(" ")[0])} />
        <span className="text-sm font-semibold">{meta.label}</span>
        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4">
          {items.length}
        </Badge>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
            <span className="text-xs font-mono break-all">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiProfileSection({
  grouped,
}: {
  grouped: Record<string, ProfileItem[]>;
}) {
  const categories = Object.keys(grouped);
  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-teal-500/30 bg-teal-950/10 p-6 flex flex-col items-center gap-2 text-center">
        <Brain className="size-8 text-teal-400/50" />
        <p className="text-sm font-medium text-muted-foreground">No profile data yet</p>
        <p className="text-xs text-muted-foreground/70">
          As you chat with Jarvis, personal facts (your name, contact info, preferences, etc.) will be
          automatically extracted and shown here.
        </p>
      </div>
    );
  }

  // Sort category order: identity → contact → work → preferences → others
  const ORDER = ["identity", "contact", "work", "preferences"];
  const sorted = [
    ...ORDER.filter((c) => grouped[c]),
    ...categories.filter((c) => !ORDER.includes(c)),
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sorted.map((cat) => (
        <ProfileCategory key={cat} category={cat} items={grouped[cat]!} />
      ))}
    </div>
  );
}

export function MemorySettings() {
  const [instanceId] = useInstanceId();
  const { data, isLoading, refetch, isFetching } = trpc.nimitsJarvis.getMemories.useQuery({
    instanceId,
    limit: 50,
  });

  const hasProfile = data?.aiProfile && data.aiProfile.total > 0;

  return (
    <div className="space-y-4">
      {/* ── AI Profile Section ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-4 text-teal-400" />
                AI Profile
              </CardTitle>
              <CardDescription className="mt-0.5">
                Personal facts Jarvis has learned about you — automatically extracted from your conversations.
              </CardDescription>
            </div>
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh profile"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : (
            <AiProfileSection grouped={data?.aiProfile?.grouped ?? {}} />
          )}
          {hasProfile && (
            <p className="text-[10px] text-muted-foreground/50 mt-3">
              {data!.aiProfile!.total} facts extracted · powered by Mnemosyne
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Episodic Memory Section ── */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Store</CardTitle>
          <CardDescription>
            Things your agent has remembered across conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Brain className="text-muted-foreground mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                No memories yet. Your agent will remember things as you chat.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.items.map((memory) => (
                <li
                  key={memory.id}
                  className="border-border bg-card flex flex-col gap-1 rounded-md border p-3"
                >
                  <p className="text-foreground text-sm">{memory.content}</p>
                  <span className="text-muted-foreground text-xs">
                    {moment(memory.createdAt).fromNow()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
