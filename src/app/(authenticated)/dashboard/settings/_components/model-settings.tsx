"use client";

import { useState, useMemo } from "react";
import { Loader2, ChevronsUpDown, Check, Shield } from "lucide-react";
import { trpc } from "~/clients/trpc";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import {
  showSuccessToast,
  trpcToastOnError,
} from "~/components/core/toast-notifications";

interface ModelSettingsProps {
  currentModel: string;
  piiRedactionEnabled: boolean;
}

export function ModelSettings({ currentModel, piiRedactionEnabled }: ModelSettingsProps) {
  const { data: vercelModels, isLoading: isLoadingVercel } = trpc.trustclaw.getVercelModels.useQuery();
  const { data: openRouterModels, isLoading: isLoadingOpenRouter } = trpc.trustclaw.getOpenRouterModels.useQuery();
  const isLoading = isLoadingVercel || isLoadingOpenRouter;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(currentModel);
  const utils = trpc.useUtils();

  const updateSettings = trpc.trustclaw.updateSettings.useMutation({
    onSuccess: () => {
      showSuccessToast("Settings updated");
      void utils.trustclaw.getInstance.invalidate();
    },
    onError: trpcToastOnError,
  });

  const [piiEnabled, setPiiEnabled] = useState(piiRedactionEnabled);

  const allModels = useMemo(() => {
    const list: Array<{
      value: string;
      label: string;
      provider: string;
      description: string;
    }> = [
      {
        value: "qwen3:8b",
        label: "Ollama Qwen3 8B (Local)",
        provider: "local",
        description: "Local model running on your machine",
      },
    ];

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
  }, [vercelModels, openRouterModels, isLoading, currentModel]);

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

  const selectedItem = allModels.find((m) => m.value === selectedModel);
  const hasChanges = selectedModel !== currentModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Settings</CardTitle>
        <CardDescription>
          Choose which local or Vercel model powers your assistant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Active Model</Label>
          <div>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full sm:w-80 justify-between text-left font-normal"
                >
                  <span className="truncate">
                    {selectedItem ? selectedItem.label : "Select model..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full sm:w-96 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8"
                  />
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {isLoading && allModels.length <= 1 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading models catalog...
                      </div>
                    ) : filteredGroupedKeysCount(groupedKeys) === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No models found.
                      </div>
                    ) : (
                      groupedKeys.map((provider) => (
                        <div key={provider} className="space-y-0.5">
                          <div className="text-xs font-semibold text-muted-foreground capitalize px-2 py-1 select-none border-b border-border/20 mt-1">
                            {provider}
                          </div>
                          {grouped[provider]!.map((m) => (
                            <button
                              key={m.value}
                              onClick={() => {
                                setSelectedModel(m.value);
                                setOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground flex justify-between items-center transition-colors group",
                                selectedModel === m.value && "bg-accent text-accent-foreground font-medium"
                              )}
                            >
                              <div className="flex flex-col truncate pr-2">
                                <span className="font-medium text-xs sm:text-sm">{m.label}</span>
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {m.value}
                                </span>
                              </div>
                              {selectedModel === m.value && (
                                <Check className="h-4 w-4 shrink-0 opacity-100" />
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
          </div>
        </div>
        <Button
          variant="outline"
          disabled={!hasChanges || updateSettings.isPending}
          onClick={() =>
            void updateSettings.mutateAsync({ anthropicModel: selectedModel })
          }
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Model"
          )}
        </Button>

        {/* PII Protection Toggle */}
        <div className="border-t pt-4 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <Label htmlFor="pii-toggle" className="text-sm font-semibold cursor-pointer">
                  PII Protection
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When enabled, sensitive data (emails, phone numbers, names) from your connected services
                  is redacted before being sent to external AI models and restored in the response.
                  Local models are always exempt.
                </p>
              </div>
            </div>
            <Switch
              id="pii-toggle"
              checked={piiEnabled}
              onCheckedChange={(checked) => {
                setPiiEnabled(checked);
                void updateSettings.mutateAsync({ piiRedactionEnabled: checked });
              }}
              disabled={updateSettings.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to count total grouped keys
function filteredGroupedKeysCount(keys: string[]) {
  return keys.length;
}
