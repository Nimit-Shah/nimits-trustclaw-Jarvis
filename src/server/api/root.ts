import { router, createCallerFactory } from "./trpc";
import { healthRouter } from "./routers/health";
import { nimitsJarvisRouter } from "./routers/nimits-jarvis";
import { toolkitsRouter } from "./routers/toolkits";
import { chatsRouter } from "./routers/chats";

export const appRouter = router({
  health: healthRouter,
  nimitsJarvis: nimitsJarvisRouter,
  toolkits: toolkitsRouter,
  chats: chatsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
