"use client";

import { useState } from "react";
import {
  FolderOpen,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { trpc } from "~/clients/trpc";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { useInstanceId } from "~/hooks/use-instance-id";

export function ProjectSelector() {
  const [instanceId, setInstanceId] = useInstanceId();
  const [open, setOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.nimitsJarvis.getInstance.useQuery(
    { instanceId },
    { enabled: true },
  );

  const instances = data?.instances ?? [];
  const activeId = instanceId ?? data?.instance?.id;
  const activeName =
    instances.find((i) => i.id === activeId)?.name ??
    data?.instance?.name ??
    "Select project";

  const handleSwitch = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setInstanceId(id);
    void utils.nimitsJarvis.getInstance.invalidate();
    void utils.nimitsJarvis.getHistory.invalidate();
    void utils.toolkits.getToolkits.invalidate();
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto py-1 max-w-[200px] justify-between gap-2 text-xs font-normal text-muted-foreground hover:text-foreground"
            id="project-selector-trigger"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            )}
            <div className="flex flex-col items-start text-left truncate min-w-0">
              <span className="truncate font-medium">{isLoading ? "Loading..." : activeName}</span>
              {data?.instance?.composioProjectId && (
                <span className="text-[9px] text-muted-foreground/60 font-mono tracking-tight -mt-0.5">
                  {data.instance.composioProjectId}
                </span>
              )}
            </div>
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-64 p-1.5" align="start">
          <div className="space-y-0.5">
            {instances.length === 0 && !isLoading && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No projects yet
              </div>
            )}
            {instances.map((inst) => (
              <button
                key={inst.id}
                onClick={() => handleSwitch(inst.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
                  inst.id === activeId &&
                    "bg-accent text-accent-foreground font-medium",
                )}
              >
                <div className="flex flex-col items-start text-left truncate mr-2">
                  <span className="truncate font-medium">{inst.name}</span>
                  {inst.composioProjectId && (
                    <span className="text-[9px] text-muted-foreground/75 font-mono tracking-tight mt-0.5">
                      {inst.composioProjectId}
                    </span>
                  )}
                </div>
                {inst.id === activeId && (
                  <Check className="ml-2 h-3 w-3 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
