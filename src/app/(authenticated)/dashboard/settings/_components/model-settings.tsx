"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { trpc } from "~/clients/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  showSuccessToast,
  trpcToastOnError,
} from "~/components/core/toast-notifications";
import { useInstanceId } from "~/hooks/use-instance-id";

export interface ModelSettingsProps {
  piiRedactionEnabled: boolean;
  openRouterGatewayEnabled: boolean;
}

export function ModelSettings({
  piiRedactionEnabled,
  openRouterGatewayEnabled,
}: ModelSettingsProps) {
  const [instanceId] = useInstanceId();
  const [piiEnabled, setPiiEnabled] = useState(piiRedactionEnabled);
  const [openRouterEnabled, setOpenRouterEnabled] = useState(openRouterGatewayEnabled);
  const utils = trpc.useUtils();

  const updateSettings = trpc.nimitsJarvis.updateSettings.useMutation({
    onSuccess: () => {
      showSuccessToast("Settings updated");
      void utils.nimitsJarvis.getInstance.invalidate();
    },
    onError: trpcToastOnError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>
          Manage data privacy and protection layers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PII Protection Toggle */}
        <div>
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
                void updateSettings.mutateAsync({ instanceId, piiRedactionEnabled: checked });
              }}
              disabled={updateSettings.isPending}
            />
          </div>
        </div>

        {/* API Gateway Toggle */}
        <div className="border-t pt-4 mt-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="openrouter-gateway-toggle" className="text-sm font-semibold cursor-pointer">
                OpenRouter Gateway
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enable models routed through OpenRouter (provides access to thousands of open-source and proprietary models).
              </p>
            </div>
            <Switch
              id="openrouter-gateway-toggle"
              checked={openRouterEnabled}
              onCheckedChange={(checked) => {
                setOpenRouterEnabled(checked);
                void updateSettings.mutateAsync({ instanceId, openRouterGatewayEnabled: checked });
              }}
              disabled={updateSettings.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}