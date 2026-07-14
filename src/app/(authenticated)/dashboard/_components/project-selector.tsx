"use client";

import { useState } from "react";
import {
  FolderOpen,
  ChevronDown,
  Plus,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import {
  showSuccessToast,
  trpcToastOnError,
} from "~/components/core/toast-notifications";
import { useInstanceId } from "~/hooks/use-instance-id";

export function ProjectSelector() {
  const [instanceId, setInstanceId] = useInstanceId();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

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

  const createInstance = trpc.nimitsJarvis.createInstance.useMutation({
    onSuccess: (newInstance) => {
      showSuccessToast(`Project "${newInstance.id}" created`);
      void utils.nimitsJarvis.getInstance.invalidate();
      setInstanceId(newInstance.id);
      setDialogOpen(false);
      setNewName("");
      setNewApiKey("");
    },
    onError: trpcToastOnError,
  });

  const handleSwitch = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setInstanceId(id);
    // Invalidate all scoped queries so they refetch with the new instanceId
    void utils.nimitsJarvis.getInstance.invalidate();
    void utils.nimitsJarvis.getHistory.invalidate();
    void utils.toolkits.getToolkits.invalidate();
    setOpen(false);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    void createInstance.mutateAsync({
      name: newName.trim(),
      ...(newApiKey.trim() ? { composioApiKey: newApiKey.trim() } : {}),
    });
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

            <div className="my-1 border-t border-border/40" />

            <button
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3 w-3" />
              Create new project…
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
            <DialogDescription>
              Each project has its own chat history and connected integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs">
                Project name
              </Label>
              <Input
                id="project-name"
                placeholder="Personal Account"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="composio-api-key" className="text-xs">
                Composio API key{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="composio-api-key"
                type="password"
                placeholder="ak_..."
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                className="h-8 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to use the global Composio key. Stored encrypted
                at rest.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || createInstance.isPending}
            >
              {createInstance.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
