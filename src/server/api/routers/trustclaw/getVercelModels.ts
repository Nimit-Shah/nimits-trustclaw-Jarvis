import { protectedProcedure } from "~/server/api/trpc";

export interface VercelModelInfo {
  id: string;
  name: string;
  type: string;
}

export const getVercelModels = protectedProcedure.query(async () => {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models");
    if (!res.ok) {
      throw new Error(`Failed to fetch models from Vercel: ${res.statusText}`);
    }
    const data = (await res.json()) as {
      object: string;
      data: Array<{ id: string; name: string; type: string; object: string }>;
    };
    
    // Filter to only include language models
    const languageModels = data.data
      .filter((model) => model.type === "language")
      .map((model) => ({
        id: model.id,
        name: model.name || model.id,
        type: model.type,
      }));
      
    return languageModels;
  } catch (error) {
    console.error("Error fetching Vercel models:", error);
    // Return empty array to fall back gracefully in the UI
    return [];
  }
});
