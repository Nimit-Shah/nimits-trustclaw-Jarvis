import { z } from "zod";

export const getAuthLinkInput = z.object({
  // Scopes the authorization connection to the active project
  instanceId: z.string().optional(),
  toolkit: z.string().min(1),
});

export type GetAuthLinkInput = z.infer<typeof getAuthLinkInput>;
