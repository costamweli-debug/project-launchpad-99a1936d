import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Google Gemini exposes an OpenAI-compatible endpoint at
 * https://generativelanguage.googleapis.com/v1beta/openai/
 * so we can reuse the openai-compatible AI SDK provider.
 */
export function createGeminiProvider(geminiApiKey: string) {
  return createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: {
      Authorization: `Bearer ${geminiApiKey}`,
    },
  });
}
