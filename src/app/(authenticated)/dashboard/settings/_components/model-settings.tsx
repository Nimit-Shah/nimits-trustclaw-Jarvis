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

export function ModelSettings({ piiRedactionEnabled }: { piiRedactionEnabled: boolean }) {
  const [piiEnabled, setPiiEnabled] = useState(piiRedactionEnabled);
  const utils = trpc.useUtils();

  const updateSettings = trpc.trustclaw.updateSettings.useMutation({
    onSuccess: () => {
      showSuccessToast("Settings updated");
      void utils.trustclaw.getInstance.invalidate();
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
