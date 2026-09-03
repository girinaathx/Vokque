import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { resolveChatProvider } from "@/lib/ai/providers.server";
import { createArtifactTools } from "@/lib/artifacts/tools.server";
import { createClient } from "@supabase/supabase-js";
import Firecrawl from "@mendable/firecrawl-js";


// Heuristic: does this user turn need fresh web info?
const FACTUAL_HINTS =
  /\b(today|tonight|tomorrow|yesterday|current|currently|now|latest|breaking|news|score|scores|weather|forecast|temperature|stock|share price|market|nasdaq|dow|s&p|bitcoin|crypto|price of|who won|who is (the )?(president|prime minister|ceo|pm|chancellor)|when is|when did|release date|launched|released|update on|status of|schedule)\b/i;
const QUESTION_HINTS = /[?]|^(what|when|where|who|which|how much|how many|is|are|does|do|did)\b/i;

function needsSearch(text: string): boolean {
  if (!text || text.length < 3) return false;
  if (text.length > 800) return false;
  if (FACTUAL_HINTS.test(text)) return true;
  // Year mentions like "2025", "2026" often mean current events
  if (/\b20(2[4-9]|3\d)\b/.test(text) && QUESTION_HINTS.test(text)) return true;
  return false;
}

type SearchHit = { title: string; url: string; snippet: string };

async function maybeWebSearch(
  query: string,
): Promise<{ block: string; forceCite: boolean }> {
  if (!needsSearch(query)) return { block: "", forceCite: false };
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      block:
        "\n\nLIVE WEB SEARCH: unavailable (search provider not configured). If the user asks about current events, news, weather, stocks, sports, prices, dates, or public officials, tell them plainly that live internet search is currently unavailable — do NOT guess or fabricate.",
      forceCite: false,
    };
  }
  try {
    const fc = new Firecrawl({ apiKey });
    const res = await fc.search(query, { limit: 6 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = res as any;
    const list: SearchHit[] = (
      raw?.web ??
      raw?.data?.web ??
      raw?.data ??
      raw?.results ??
      []
    )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        title: String(r?.title ?? r?.name ?? "").slice(0, 200),
        url: String(r?.url ?? r?.link ?? ""),
        snippet: String(r?.description ?? r?.snippet ?? r?.content ?? "").slice(
          0,
          400,
        ),
      }))
      .filter((h: SearchHit) => h.url);
    if (list.length === 0) {
      return {
        block:
          "\n\nLIVE WEB SEARCH: no results returned. If you can't answer confidently from general knowledge, say so instead of guessing.",
        forceCite: false,
      };
    }
    const formatted = list
      .slice(0, 6)
      .map(
        (h, i) =>
          `[${i + 1}] ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}`,
      )
      .join("\n\n");
    return {
      block: `\n\nLIVE WEB SEARCH RESULTS (Google-style, fetched just now for the user's query — TREAT AS AUTHORITATIVE OVER YOUR TRAINING DATA for anything time-sensitive):\n${formatted}\n\nRULES FOR USING THESE RESULTS:\n- Base factual claims about current events, news, weather, prices, dates, sports, or people-in-office ONLY on these results.\n- Never fabricate a URL, headline, number, or date. If the results don't cover it, say so.\n- Summarize in your own words, don't dump the snippets verbatim.\n- Cite sources inline as [[n]](URL) matching the numbered results, and end with a "## Sources" section listing the ones you used.`,
      forceCite: true,
    };
  } catch (err) {
    console.error("Firecrawl search failed:", err);
    return {
      block:
        "\n\nLIVE WEB SEARCH: unavailable right now (search provider error). Tell the user internet search is temporarily unavailable rather than guessing about current events.",
      forceCite: false,
    };
  }
}

const FILE_CAPABILITIES = `

FILE & ARTIFACT CAPABILITIES — you can actually create real, downloadable files. You have working tools; use them instead of pasting long content into chat:
- create_document → PDF, DOCX, RTF, HTML, MD, TXT (reports, letters, essays, resumes, contracts, guides).
- create_spreadsheet → XLSX, ODS, CSV, TSV, JSON, XML (multi-sheet; a cell value starting with "=" becomes a live Excel formula).
- create_presentation → PPTX with cover slide, bullets, tables, charts and speaker notes.
- create_code_file → runnable source files in any supported language.
- create_text_file → raw text/markdown/json/xml/csv/html.
- generate_image → real PNG images from a prompt. create_svg_image → real vector SVG.
- create_zip_archive → bundle files you already created in this conversation.

WHEN TO USE THEM:
- The user asks to "create / make / generate / write / export / download / give me" a document, sheet, deck, image, dataset or code file → call the matching tool.
- The user asks to CONVERT a file (e.g. PDF → DOCX, image → description, CSV → XLSX, doc → deck): read the attached file directly (you can see PDFs, images, audio, video and text), extract the full content, then call the tool for the target format. Preserve headings, lists, tables and ordering.
- The user asks to ANALYZE or SUMMARIZE an attachment: answer in chat; only produce a file if they ask for one.
- Multiple requested files → call the tools one after another, then optionally zip them.

RULES:
- Never fabricate a download link, file name or "file created" claim. A file exists only when a tool returns it — the app renders the download card automatically.
- Never paste base64, file paths or storage URLs into your reply.
- Write COMPLETE content: real sections, real rows, real code. No "TODO", no lorem ipsum, no placeholders.
- After a tool succeeds, reply with one or two short sentences about what you made — do not repeat the whole document.
- If a tool returns an error, say plainly what failed and offer an alternative format.
- Binary image format conversion (e.g. JPG → PNG) is not supported; offer to regenerate or describe the image instead.`;


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

const CORE_SYSTEM = `You are Avenxa — the official AI assistant of the Avenxa platform. You are a premium AI operating system that combines a team of specialist agents into one unified voice. You are warm, accurate, professional, and proactive. You don't just answer — you take action, produce artifacts (plans, drafts, docs, code, designs), and help the user reach real outcomes.

IDENTITY:
- Your name and identity is "Avenxa".
- If asked "Who created you?" or "Who made you?", reply EXACTLY: "Avenxa was created and developed by the CEO of O1 Platforms, Mokalla Girinaath. I am the AI assistant experience provided through the Avenxa platform."
- If asked about the technology, models, or what powers you, reply: "Avenxa may use multiple AI models, APIs, and technologies to provide its capabilities. The platform and user experience are developed by O1 Platforms."
- Never claim O1 Platforms trained the underlying foundation model from scratch. Be transparent about the distinction between the Avenxa platform and any underlying AI technologies. Always represent the Avenxa brand professionally.

GOLDEN RULE: behave like an AI operating system, not a chatbot. Remember the user, collaborate across specialties, execute, and ship outcomes.

RESPONSE STYLE (important):
- Answer directly. No preamble, no "Great question", no restating the question.
- Keep it simple, clean, and easy to read. Natural language, no filler, no repetition.
- Match length to the question: simple question → 1–3 sentences; complex question → structured explanation with short paragraphs, bullets, and headings.
- Bold only genuinely important words. Never bold whole paragraphs.
- Friendly, professional tone. Clarity beats completeness.

VOICE: thoughtful, concise, kind. Use clean markdown. Emojis sparingly. Acknowledge feelings briefly before helping. Offer a concrete next step when it's useful.

MEMORY: you never save memories on your own. If the user says "remember this", confirm and tell them to tap "Save to Memory" on the message (or offer the exact sentence to save).

ROUTING: At the very start of every reply, output a hidden HTML comment naming the specialist(s) you are channeling, picked from: Business, Coding, Design, Research, General. Format EXACTLY:
<!--agents:X,Y-->
Pick 1–3 of the most relevant agents. Do not mention this comment to the user. After the comment, continue with your normal markdown reply on a new line. Never wrap the comment in code fences.

MATHEMATICS: Avenxa has full LaTeX rendering (KaTeX). Always write mathematics in LaTeX — never plain-text approximations. Use $...$ for inline math and $$...$$ on their own lines for display math. Use proper commands: \\frac, \\sqrt, \\int, \\sum, \\lim, \\begin{pmatrix}...\\end{pmatrix}, \\begin{cases}...\\end{cases}, \\vec, \\partial. For any calculation, show the steps in order, each on its own display line, then state the final answer clearly. Cover arithmetic, algebra, geometry, trigonometry, calculus, linear algebra, statistics, probability, and physics-style derivations.

PROACTIVE: when the user has a goal, break it into steps, name obstacles, recommend actions, and offer to execute (draft the email, build the plan, write the code, outline the design).${FILE_CAPABILITIES}`;

const CITE_INSTRUCTIONS = `\n\nCITATIONS MODE — ON.
- For any factual recommendation in travel, fitness, productivity, study, health, news, or research, cite a credible public source.
- Inline citations: append a numeric marker after the claim as [[1]](https://full.url) — the marker itself a real markdown link.
- End with a "## Sources" section as a numbered list: "1. [Title — Publisher](https://full.url)".
- Never fabricate URLs.`;

type ChatBody = {
  messages?: UIMessage[];
  threadId?: string;
  guest?: boolean;
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
        let provider;
        try {
          provider = resolveChatProvider();
        } catch {
          return new Response("AI is not configured.", { status: 500 });
        }
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;


        const body = (await request.json()) as ChatBody;
        const messages = body.messages ?? [];
        const isGuest = body.guest === true;

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : "";
        if (!token && !isGuest) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Guest mode: no account, no persistence, no memory. Capped client-side.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let supa: any = null;
        let userId = "";
        const threadId = body.threadId ?? "";
        let mems: { content: string; category: string }[] | null = null;

        if (!isGuest) {
          supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: claimsData, error: claimsErr } =
            await supa.auth.getClaims(token);
          if (claimsErr || !claimsData?.claims?.sub) {
            return new Response("Unauthorized", { status: 401 });
          }
          userId = claimsData.claims.sub;

          if (!threadId)
            return new Response("Missing threadId", { status: 400 });

          // Verify the thread belongs to the authenticated user before any writes.
          const { data: ownedThread } = await supa
            .from("threads")
            .select("id")
            .eq("id", threadId)
            .eq("user_id", userId)
            .maybeSingle();
          if (!ownedThread) return new Response("Forbidden", { status: 403 });
        }

        // Persist the latest user message (last item) before streaming.
        const last = messages[messages.length - 1];
        if (supa && last && last.role === "user") {
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
        if (supa) {
          const { data } = await supa
            .from("memories")
            .select("content, category")
            .order("created_at", { ascending: false })
            .limit(40);
          mems = (data as { content: string; category: string }[]) ?? null;
        }


        const model = provider.model;
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

        // Live Google-style web search via Firecrawl for factual queries.
        const userQueryText =
          last && last.role === "user"
            ? last.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join(" ")
                .trim()
            : "";
        const { block: searchBlock, forceCite } = await maybeWebSearch(userQueryText);

        const systemPrompt =
          CORE_SYSTEM +
          personaBlock +
          dateBlock +
          buildMemoryBlock(mems) +
          searchBlock +
          (body.cite || forceCite ? CITE_INSTRUCTIONS : "");



        try {
          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            tools: createArtifactTools({
              userId: isGuest ? null : userId,
              threadId: threadId || null,
            }),
            stopWhen: stepCountIs(50),
            providerOptions: provider.options,
            abortSignal: request.signal,
          });


          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ messages: finalMessages, isAborted }) => {
              if (isAborted) return;
              const assistant = finalMessages[finalMessages.length - 1];
              if (supa && assistant && assistant.role === "assistant") {
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
              }
            },

          });
        } catch (err) {
          console.error("Chat AI error:", err);
          return new Response("Something went wrong. Please try again.", { status: 500 });
        }
      },
    },
  },
});
