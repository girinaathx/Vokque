import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provider abstraction. Google Gemini is the primary provider; the Lovable AI
 * Gateway is the automatic fallback so chat keeps working if GEMINI_API_KEY is
 * absent. Adding another provider = one more case here, nothing else changes.
 */
export type ProviderName = "gemini" | "lovable";

export type ChatProvider = {
  name: ProviderName;
  /** Model id used for conversational turns + tool calling. */
  modelId: string;
  /** Provider-specific request fields, keyed for `providerOptions`. */
  options: Record<string, Record<string, unknown>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
};


const GEMINI_MODEL = "gemini-3.6-flash";
const LOVABLE_MODEL = "google/gemini-3.7-flash";

export function resolveChatProvider(): ChatProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    // Google's official OpenAI-compatible surface — supports streaming,
    // function calling and multimodal (image / audio / PDF) inputs.
    const google = createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { Authorization: `Bearer ${geminiKey}` },
    });
    return {
      name: "gemini",
      modelId: GEMINI_MODEL,
      // Thinking off: the OpenAI-compatible surface cannot round-trip Gemini 3
      // thought signatures, which breaks multi-step tool calling.
      options: { gemini: { reasoningEffort: "none" } },
      model: google(GEMINI_MODEL),
    };
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("No AI provider configured.");
  const lovable = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return {
    name: "lovable",
    modelId: LOVABLE_MODEL,
    options: {},
    model: lovable(LOVABLE_MODEL),
  };
}
}
