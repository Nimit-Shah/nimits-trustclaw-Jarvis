import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream/generic";
import { getRedisPublisher, getRedisSubscriber, isRedisConfigured } from "~/server/clients/redis";

// Lazily initialised — only when Redis is available.
let streamContextCache: any = null;

interface StreamContext {
  createNewResumableStream(
    streamId: string,
    getStream: () => ReadableStream<string>,
  ): Promise<ReadableStream<string> | null>;
  resumeExistingStream(
    streamId: string,
    skipCharacters?: number,
  ): Promise<ReadableStream<string> | null | undefined>;
}

export function getStreamContext(): StreamContext | null {
  if (!isRedisConfigured()) return null;

  if (!streamContextCache) {
    const publisher = getRedisPublisher();
    const subscriber = getRedisSubscriber();
    if (!publisher || !subscriber) return null;

    // Use the generic entrypoint from resumable-stream.
    // It requires publisher/subscriber to be passed explicitly, bypassing
    // any internal/default package imports of optional dependencies like ioredis/redis.
    // The library automatically wraps raw ioredis instances when passed.
    streamContextCache = createResumableStreamContext({
      waitUntil: after,
      publisher: publisher as any,
      subscriber: subscriber as any,
    });
  }

  return streamContextCache;
}
