interface StreamContext {
  createNewResumableStream(
    streamId: string,
    getStream: () => ReadableStream,
  ): void;
  resumeExistingStream(streamId: string): Promise<ReadableStream | null>;
}

export function getStreamContext(): StreamContext | null {
  return null;
}
