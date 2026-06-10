import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { truncateThreadMessages } from "@/lib/threads.functions";
import {
  ArrowUpRight,
  Copy,
  Check,
  RotateCcw,
  Square,
  Pencil,
  Mic,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        fetch: async (url, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(url, { ...init, headers });
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, regenerate, setMessages, error } =
    useChat({
      id: threadId,
      messages: initialMessages,
      transport,
      onError: (e) => toast.error(e.message || "Something went wrong"),
    });

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  // Auto-focus + auto-scroll
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  // Auto-send seed from dashboard quick-action
  useEffect(() => {
    const seed = sessionStorage.getItem(`oi:seed:${threadId}`);
    if (seed && messages.length === 0) {
      sessionStorage.removeItem(`oi:seed:${threadId}`);
      sendMessage({ text: seed });
    }
  }, [threadId, messages.length, sendMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const handleEditSave = (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const truncated = messages.slice(0, idx);
    setMessages(truncated);
    setEditingId(null);
    sendMessage({ text: editValue });
  };

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-1 flex-col">
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-2 pb-44 lg:px-8 lg:pt-6"
      >
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {messages.length === 0 && (
            <EmptyState onPick={(t) => sendMessage({ text: t })} />
          )}

          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            return (
              <div
                key={m.id}
                className={cn(
                  "animate-fade-up group flex gap-3",
                  isUser ? "justify-end" : "justify-start",
                )}
              >
                {!isUser && (
                  <div className="glass mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl">
                    <Logo size={18} />
                  </div>
                )}

                <div
                  className={cn(
                    "min-w-0 max-w-[88%] flex-col",
                    isUser ? "items-end" : "items-start",
                  )}
                >
                  {editingId === m.id && isUser ? (
                    <div className="glass-bubble-user w-full rounded-3xl p-3">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        rows={3}
                        className="w-full resize-none bg-transparent text-[15px] outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="hover:bg-black/5 rounded-full px-3 py-1 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSave(m.id)}
                          className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium"
                        >
                          Update & resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-3xl px-4 py-3 text-[15px] leading-relaxed",
                        isUser
                          ? "glass-bubble-user rounded-tr-lg"
                          : "glass-bubble-ai rounded-tl-lg",
                      )}
                    >
                      <Markdown text={text} />
                      {!isUser &&
                        idx === messages.length - 1 &&
                        status === "streaming" &&
                        !text && <span className="shimmer-text">Thinking…</span>}
                    </div>
                  )}

                  {/* Message actions */}
                  {!editingId && text && (
                    <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <CopyBtn text={text} />
                      {isUser && (
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditValue(text);
                          }}
                          className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      )}
                      {!isUser && idx === messages.length - 1 && !isLoading && (
                        <button
                          onClick={() => regenerate()}
                          className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                        >
                          <RotateCcw className="h-3 w-3" /> Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="animate-fade-up flex gap-3">
              <div className="glass mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl">
                <Logo size={18} />
              </div>
              <div className="glass-bubble-ai rounded-3xl rounded-tl-lg px-4 py-3">
                <span className="shimmer-text text-[15px]">Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-destructive text-center text-xs">
              {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Floating composer dock */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 px-3 pb-4 lg:px-8 lg:pb-6">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="glass-dock liquid-shine liquid-shine-after flex items-end gap-1.5 rounded-[28px] p-2"
          >
            <button
              type="button"
              className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition"
              aria-label="Attach"
              onClick={() => toast.info("Attachments coming soon")}
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={1}
              placeholder="Message Open Intelligence…"
              className="placeholder:text-muted-foreground/70 max-h-48 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none"
            />
            <button
              type="button"
              className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition"
              aria-label="Voice"
              onClick={() => toast.info("Voice coming soon")}
            >
              <Mic className="h-4.5 w-4.5" />
            </button>
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95"
                aria-label="Stop"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40"
                aria-label="Send"
              >
                <ArrowUpRight className="h-4.5 w-4.5" />
              </button>
            )}
          </form>
          <p className="text-muted-foreground/60 mt-2 text-center text-[10px]">
            Open Intelligence can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> Copy
        </>
      )}
    </button>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-neutral max-w-none [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-black/6 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_p]:my-0 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/90 [&_pre]:p-3 [&_pre]:text-[12.5px] [&_pre_code]:bg-transparent [&_pre_code]:text-white [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  const starters = [
    "Hey! 👋 How has your day been so far?",
    "Help me plan a focused study session",
    "Suggest a 30-min workout I can do at home",
    "Plan a weekend trip somewhere unexpected",
  ];
  return (
    <div className="animate-fade-up flex flex-col items-center pt-12 text-center">
      <div className="animate-float-slow">
        <Logo size={56} glow />
      </div>
      <h2 className="font-display mt-5 text-2xl font-semibold tracking-tight">
        What's on your mind?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        I'm here to help — ask me anything.
      </p>
      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="glass hover:bg-glass-strong rounded-2xl px-4 py-3 text-left text-sm transition hover:-translate-y-px"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
