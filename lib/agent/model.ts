export interface ModelConfig {
  providerId: "openai-compatible";
  baseUrl: string;
  apiKey: string | undefined;
  modelId: string;
}

export function getModelConfig(): ModelConfig {
  return {
    providerId: "openai-compatible",
    baseUrl: "https://api.cline.bot/api/v1",
    apiKey: process.env.CLINE_API_KEY,
    modelId: process.env.HAQ_MODEL ?? "minimax/minimax-m2.5",
  };
}
