import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are Open Intelligence — a warm, witty, premium AI companion that helps with travel, fitness, productivity, study, daily planning, and intelligent conversation. You speak like a thoughtful friend: concise, encouraging, never robotic. Use clean markdown. Use emojis sparingly and only when they add warmth. When the user shares feelings, acknowledge them briefly before helping. Offer concrete next steps. Default to short responses unless the user asks for depth.`;

const CITE_INSTRUCTIONS = `\n\nCITATIONS MODE — ON.
- For any factual recommendation in travel, fitness, productivity, study, health, or news, cite a credible public source.
- Inline citations: append a numeric marker after the claim in the form [[1]](https://full.url) — make the marker itself a real markdown link to the source URL.
- End the message with a "## Sources" section listing each source as a numbered markdown link: "1. [Title — Publisher](https://full.url)".
- Only cite sources you are confident exist (well-known publishers, official sites, major outlets). Never fabricate URLs. If you are not sure of a URL, say so plainly instead of guessing.
- For purely conversational, emotional, or opinion replies, skip citations.`;

type ChatBody = {
  messages?: UIMessage[];
  threadId?: string;
  cite?: boolean;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }
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
          // Touch thread updated_at + auto-title if still default
          const firstText =
            last.parts.find((p) => p.type === "text")?.text?.slice(0, 60) ??
            "New conversation";
          await supa
            .from("threads")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("id", threadId);
          // Best-effort title set only when current title is default
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

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = streamText({
            model: gateway("google/gemini-2.5-flash"),
            system: SYSTEM_PROMPT,
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
