import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  generateText,
  streamText,
  type UIMessage,
} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";

const OPENAI_MODEL = "gpt-4o-mini";

const AGENTS = ["Business", "Coding", "Design", "Research", "General"] as const;
type Agent = (typeof AGENTS)[number];

const AGENT_PERSONAS: Record<Agent, string> = {
  Business:
    "Business AI — startup strategy, marketing, branding, sales, growth, monetization, GTM.",
  Coding:
    "Coding AI — software engineering, web/mobile dev, APIs, debugging, system architecture, code review.",
  Design:
    "Design AI — UI/UX, product design, brand systems, typography, graphics, design tokens.",
  Research:
    "Research AI — deep research, fact-checking, market intelligence, source-backed summaries.",
  General:
    "General assistant — everyday help: travel, fitness, productivity, daily planning, conversation.",
};

const CORE_SYSTEM = `You are FeynCloud — the official AI assistant of the FeynCloud platform. You are a premium AI operating system that combines a team of specialist agents into one unified voice. You are warm, accurate, professional, and proactive. You don't just answer — you take action, produce artifacts (plans, drafts, docs, code, designs), and help the user reach real outcomes.

IDENTITY:
- Your name and identity is "FeynCloud".
- If asked "Who created you?" or "Who made you?", reply EXACTLY: "FeynCloud was created and developed by the CEO of O1 Platforms, Mokalla Girinaath. I am the AI assistant experience provided through the FeynCloud platform."
- If asked about the technology, models, or what powers you, reply: "FeynCloud may use multiple AI models, APIs, and technologies to provide its capabilities. The platform and user experience are developed by O1 Platforms."
- Never claim O1 Platforms trained the underlying foundation model from scratch. Be transparent about the distinction between the FeynCloud platform and any underlying AI technologies. Always represent the FeynCloud brand professionally.

GOLDEN RULE: behave like an AI operating system, not a chatbot. Remember the user, collaborate across specialties, execute, and ship outcomes.

VOICE: thoughtful, concise, kind. Use clean markdown. Emojis sparingly. Acknowledge feelings briefly before helping. Always offer a concrete next step.

ROUTING: At the very start of every reply, output a hidden HTML comment naming the specialist(s) you are channeling, picked from: Business, Coding, Design, Research, General. Format EXACTLY:
<!--agents:X,Y-->
Pick 1–3 of the most relevant agents. Do not mention this comment to the user. After the comment, continue with your normal markdown reply on a new line. Never wrap the comment in code fences.

PROACTIVE: when the user has a goal, break it into steps, name obstacles, recommend actions, and offer to execute (draft the email, build the plan, write the code, outline the design).`;

const CITE_INSTRUCTIONS = `\n\nCITATIONS MODE — ON.
- For any factual recommendation in travel, fitness, productivity, study, health, news, or research, cite a credible public source.
- Inline citations: append a numeric marker after the claim as [[1]](https://full.url) — the marker itself a real markdown link.
- End with a "## Sources" section as a numbered list: "1. [Title — Publisher](https://full.url)".
- Never fabricate URLs.`;

type ChatBody = {
  messages?: UIMessage[];
  threadId?: string;
  cite?: boolean;
  tz?: string;
  clientNow?: string;
};


function buildMemoryBlock(
  mems: { content: string; category: string }[] | null | undefined,
) {
  if (!mems || mems.length === 0) return "";
  const lines = mems.map((m) => `- [${m.category}] ${m.content}`).join("\n");
  return `\n\nUSER MEMORY — what you know about this user. Use it naturally; never repeat it back verbatim unless asked.\n${lines}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return new Response("Missing OPENAI_API_KEY", { status: 500 });
        }
        const openai = createOpenAICompatible({
          name: "openai",
          baseURL: "https://api.openai.com/v1",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } =
          await supa.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claimsData.claims.sub;

        const body = (await request.json()) as ChatBody;
        const messages = body.messages ?? [];
        const threadId = body.threadId;
        if (!threadId) return new Response("Missing threadId", { status: 400 });

        // Persist the latest user message (last item) before streaming.
        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          await supa.from("messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: last.parts,
          });
          const firstText =
            last.parts.find((p) => p.type === "text")?.text?.slice(0, 60) ??
            "New conversation";
          await supa
            .from("threads")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", threadId);
          const { data: t } = await supa
            .from("threads")
            .select("title")
            .eq("id", threadId)
            .maybeSingle();
          if (t && t.title === "New conversation" && firstText) {
            await supa
              .from("threads")
              .update({ title: firstText })
              .eq("id", threadId);
          }
        }

        // Load user memories to inject as context.
        const { data: mems } = await supa
          .from("memories")
          .select("content, category")
          .order("created_at", { ascending: false })
          .limit(40);

        const model = openai(OPENAI_MODEL);
        const personaBlock =
          "\n\nSPECIALIST PERSONAS YOU CAN CHANNEL:\n" +
          AGENTS.map((a) => `- ${a}: ${AGENT_PERSONAS[a]}`).join("\n");

        const now = body.clientNow ? new Date(body.clientNow) : new Date();
        const tz = body.tz || "UTC";
        let localHuman = "";
        try {
          localHuman = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          }).format(now);
        } catch {
          localHuman = now.toUTCString();
        }
        const dateBlock = `\n\nCURRENT DATE & TIME (authoritative — always use this when the user asks the date, day, month, year, or time; never invent or use a stale date). Answer in the user's LOCAL timezone (${tz}):\n- User local: ${localHuman}\n- ISO (UTC): ${now.toISOString()}\n- Year: ${now.getUTCFullYear()}`;


        const systemPrompt =
          CORE_SYSTEM +
          personaBlock +
          dateBlock +
          buildMemoryBlock(mems) +
          (body.cite ? CITE_INSTRUCTIONS : "");


        try {
          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            abortSignal: request.signal,
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ messages: finalMessages, isAborted }) => {
              if (isAborted) return;
              const assistant = finalMessages[finalMessages.length - 1];
              if (assistant && assistant.role === "assistant") {
                await supa.from("messages").insert({
                  thread_id: threadId,
                  user_id: userId,
                  role: "assistant",
                  parts: assistant.parts,
                });
                await supa
                  .from("threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);

                // Auto-capture memories from this exchange (best-effort).
                try {
                  const userText =
                    last && last.role === "user"
                      ? last.parts
                          .map((p) => (p.type === "text" ? p.text : ""))
                          .join(" ")
                          .slice(0, 2000)
                      : "";
                  const assistantText = assistant.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join(" ")
                    .replace(/<!--agents:[^>]*-->/g, "")
                    .slice(0, 2000);
                  if (userText) {
                    await extractAndStoreMemories({
                      model,
                      supa,
                      userId,
                      threadId,
                      userText,
                      assistantText,
                    });
                  }
                } catch {
                  /* extraction is best-effort */
                }
              }
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});

async function extractAndStoreMemories({
  gateway,
  supa,
  userId,
  threadId,
  userText,
  assistantText,
}: {
  gateway: ReturnType<typeof createLovableAiGatewayProvider>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supa: any;
  userId: string;
  threadId: string;
  userText: string;
  assistantText: string;
}) {
  const { text } = await generateText({
    model: gateway("google/gemini-2.5-flash"),
    system: `You extract durable, user-specific memories from a chat exchange.
Return ONLY a JSON object: {"memories":[{"content":"...","category":"preference|project|goal|style|fact|general"}]}
Rules:
- Capture ONLY long-term, reusable facts about the USER (preferences, ongoing projects, goals, communication style, important personal facts).
- DO NOT capture transient questions, generic facts, the assistant's answers, or anything sensitive (passwords, payment, government IDs, health diagnoses).
- 0 to 3 items. Empty array if nothing worth remembering.
- "content" must be a single concise sentence written in third person about the user (e.g. "Prefers vegetarian meals when traveling.").`,
    prompt: `USER: ${userText}\n\nASSISTANT: ${assistantText}`,
  });

  let parsed: { memories?: { content?: string; category?: string }[] } = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return;
  }
  const items = (parsed.memories ?? [])
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 3)
    .slice(0, 3);
  if (items.length === 0) return;

  const valid = new Set([
    "preference",
    "project",
    "goal",
    "style",
    "fact",
    "general",
  ]);
  await supa.from("memories").insert(
    items.map((m) => ({
      user_id: userId,
      thread_id: threadId,
      content: m.content!.trim().slice(0, 500),
      category: valid.has(m.category ?? "") ? m.category : "general",
      source: "auto",
    })),
  );
}
