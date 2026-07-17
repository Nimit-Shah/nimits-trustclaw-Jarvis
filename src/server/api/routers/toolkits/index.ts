import { router } from "~/server/api/trpc";
import { getToolkits } from "./getToolkits";
import { getAuthLink } from "./getAuthLink";
import { disconnectToolkit } from "./disconnectToolkit";

export const toolkitsRouter = router({
  getToolkits,
  getAuthLink,
  disconnectToolkit,
});