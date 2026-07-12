import { router, createCallerFactory } from "./trpc";
import { healthRouter } from "./routers/health";
import { nimitsJarvisRouter } from "./routers/nimits-jarvis";
import { toolkitsRouter } from "./routers/toolkits";

export const appRouter = router({
  health: healthRouter,
  nimitsJarvis: nimitsJarvisRouter,
  toolkits: toolkitsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
