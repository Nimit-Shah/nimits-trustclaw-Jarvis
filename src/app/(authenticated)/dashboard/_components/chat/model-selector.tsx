"use client";

import { useState, useMemo } from "react";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { trpc } from "~/clients/trpc";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  showSuccessToast,
  trpcToastOnError,
} from "~/components/core/toast-notifications";

export function ModelSelector() {
  const { data: instance, isLoading: isInstanceLoading } = trpc.trustclaw.getInstance.useQuery();
  const { data: vercelModels, isLoading: isLoadingVercel } = trpc.trustclaw.getVercelModels.useQuery();
  const { data: openRouterModels, isLoading: isLoadingOpenRouter } = trpc.trustclaw.getOpenRouterModels.useQuery();
  const { data: localModels, isLoading: isLoadingLocal } = trpc.trustclaw.getLocalModels.useQuery();
  
  const isLoading = isLoadingVercel || isLoadingOpenRouter || isLoadingLocal || isInstanceLoading;
  const currentModel = instance?.instance?.anthropicModel ?? "qwen3:8b";

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const updateSettings = trpc.trustclaw.updateSettings.useMutation({
    onSuccess: () => {
      showSuccessToast("Model updated");
      void utils.trustclaw.getInstance.invalidate();
    },
    onError: trpcToastOnError,
  });

  const allModels = useMemo(() => {
    const list: Array<{
      value: string;
      label: string;
      provider: string;
      description: string;
    }> = [];

    if (localModels && localModels.length > 0) {
      localModels.forEach((lm) => {
        list.push({
          value: lm.id,
          label: lm.name,
          provider: "local",
          description: "Local model running on your machine",
        });
      });
    } else {
      // Fallback local model if no endpoint available or empty
      list.push({
        value: "qwen3:8b",
        label: "Ollama Qwen3 8B (Local)",
        provider: "local",
        description: "Local model running on your machine",
      });
    }

    if (vercelModels && vercelModels.length > 0) {
      vercelModels.forEach((vm) => {
        const parts = vm.id.split("/");
        const provider = parts[0] || "other";
        const modelName = vm.name || parts[1] || vm.id;

        if (vm.id !== "qwen3:8b") {
          list.push({
            value: vm.id,
            label: modelName,
            provider,
            description: "Vercel AI Gateway model",
          });
        }
      });
    }
    if (openRouterModels && openRouterModels.length > 0) {
      openRouterModels.forEach((om) => {
        list.push({
          value: `openrouter/${om.id}`,
          label: om.name,
          provider: "openrouter",
          description: "OpenRouter model",
        });
      });
    } else if (!isLoading) {
      // Fallback static models when API is empty/failed
      list.push(
        {
          value: "claude-opus-4-6",
          label: "Claude Opus 4.6",
          provider: "anthropic",
          description: "Most capable",
        },
        {
          value: "claude-sonnet-4-5-20250929",
          label: "Claude Sonnet 4.5",
          provider: "anthropic",
          description: "Balanced",
        },
        {
          value: "claude-haiku-4-5-20251001",
          label: "Claude Haiku 4.5",
          provider: "anthropic",
          description: "Fast & affordable",
        }
      );
    }

    // Ensure currently selected model is in the list
    if (currentModel && !list.some((m) => m.value === currentModel)) {
      const parts = currentModel.split("/");
      const provider = parts.length > 1 ? parts[0]! : "custom";
      const label = parts.length > 1 ? parts.slice(1).join("/") : currentModel;
      list.push({
        value: currentModel,
        label: `${label} (Saved)`,
        provider,
        description: "Currently saved model configuration",
      });
    }

    return list;
  }, [vercelModels, openRouterModels, localModels, isLoading, currentModel]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const cleanSearch = search.toLowerCase();
    return allModels.filter(
      (m) =>
        m.label.toLowerCase().includes(cleanSearch) ||
        m.value.toLowerCase().includes(cleanSearch) ||
        m.provider.toLowerCase().includes(cleanSearch)
    );
  }, [allModels, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof allModels> = {};
    filteredModels.forEach((m) => {
      if (!groups[m.provider]) {
        groups[m.provider] = [];
      }
      groups[m.provider]!.push(m);
    });
    return groups;
  }, [filteredModels]);

  const groupedKeys = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      if (a === "local") return -1;
      if (b === "local") return 1;
      if (a === "anthropic") return -1;
      if (b === "anthropic") return 1;
      return a.localeCompare(b);
    });
  }, [grouped]);

  const selectedItem = allModels.find((m) => m.value === currentModel);

  const handleSelect = (modelValue: string) => {
    setOpen(false);
    if (modelValue === currentModel) return;
    
    // Auto-save instantly!
    void updateSettings.mutateAsync({ anthropicModel: modelValue });
  };

  if (isInstanceLoading) {
    return (
      <Button variant="ghost" size="sm" className="w-48 justify-between text-muted-foreground" disabled>
        <Loader2 className="h-3 w-3 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "max-w-[250px] justify-between text-xs font-normal text-muted-foreground hover:text-foreground",
            updateSettings.isPending && "opacity-50 cursor-not-allowed"
          )}
          disabled={updateSettings.isPending}
        >
          <span className="truncate">
            {updateSettings.isPending ? "Saving..." : (selectedItem ? selectedItem.label : "Select model...")}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full sm:w-[350px] p-2" align="start">
        <div className="space-y-2">
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {isLoading && allModels.length <= 1 ? (
              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center">
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Loading models catalog...
              </div>
            ) : groupedKeys.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No models found.
              </div>
            ) : (
              groupedKeys.map((provider) => (
                <div key={provider} className="space-y-0.5">
                  <div className="text-[10px] font-semibold text-muted-foreground capitalize px-2 py-1 select-none border-b border-border/20 mt-1">
                    {provider}
                  </div>
                  {grouped[provider]!.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => handleSelect(m.value)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-accent hover:text-accent-foreground flex justify-between items-center transition-colors group",
                        currentModel === m.value && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-[9px] text-muted-foreground/70 truncate">
                          {m.value}
                        </span>
                      </div>
                      {currentModel === m.value && (
                        <Check className="h-3 w-3 shrink-0 opacity-100" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
