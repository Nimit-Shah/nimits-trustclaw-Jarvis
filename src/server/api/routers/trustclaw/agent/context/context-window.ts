export function getContextWindow(modelId: string): number {
  if (modelId === "qwen3:8b") {
    return 16_000;
  }
  return 200_000;
}
