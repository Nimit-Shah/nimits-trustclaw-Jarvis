import { z } from "zod";
import { ALLOWED_ANTHROPIC_MODELS } from "./createInstance.schema";

const ianaTimezone = z
  .string()
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid IANA timezone" },
  );

export const updateSettingsInput = z.object({
  anthropicModel: z.string().optional(),
  timezone: ianaTimezone.optional(),
  piiRedactionEnabled: z.boolean().optional(),
  vercelGatewayEnabled: z.boolean().optional(),
  openRouterGatewayEnabled: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;
