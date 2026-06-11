import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const ARIA_SYSTEM = `You are Aria — a premium AI executive assistant.

PERSONALITY:
- Female, professional, formal, intelligent, polite.
- Confident, warm, respectful — never robotic, never slangy.
- Uses proper grammar and clear, executive-grade language.

VOICE OUTPUT RULES (you will be spoken aloud, NOT read):
- Reply in plain spoken prose. No markdown, no headings, no bullet points, no asterisks, no code blocks, no emojis, no URLs.
- Keep responses concise and easy to listen to — usually 1 to 3 short sentences unless the user explicitly asks for detail.
- Use natural human pacing with commas and periods. Spell out symbols when needed.
- Pronounce names carefully; if uncertain, briefly ask the user to confirm.
- If a question is ambiguous, ask one short clarifying question.
- Acknowledge feelings briefly when the user shares emotions, then assist.
- Default to formal tone unless the user asks you to be casual.`;

type Turn = { role: "user" | "assistant"; content: string };

export const ariaReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { transcript: string; history?: Turn[] }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const transcript = (data.transcript ?? "").trim();
    if (!transcript) throw new Error("Empty transcript");

    const history = (data.history ?? []).slice(-12);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system: ARIA_SYSTEM,
      messages: [
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: "user" as const, content: transcript },
      ],
    });

    // Strip any stray markdown the model may have emitted so TTS sounds clean.
    const clean = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[*_`#>]+/g, "")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{2,}/g, ". ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return { text: clean };
  });
