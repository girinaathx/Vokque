import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { truncateThreadMessages } from "@/lib/threads.functions";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  ArrowUp,
  Copy,
  Check,
  RotateCcw,
  Square,
  Pencil,
  Mic,
  MicOff,
  Paperclip,
  Quote,
  ExternalLink,
  Brain,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createMemory } from "@/lib/memories.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

const AGENT_STYLES: Record<string, string> = {
  Business: "bg-amber-100 text-amber-900",
  Coding: "bg-sky-100 text-sky-900",
  Design: "bg-pink-100 text-pink-900",
  Research: "bg-emerald-100 text-emerald-900",
  General: "bg-black/6 text-foreground",
};

function parseAgents(text: string): { agents: string[]; body: string } {
  const m = text.match(/^\s*<!--\s*agents:([^>]*?)-->\s*\n?/i);
  if (!m) return { agents: [], body: text };
  const agents = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { agents, body: text.slice(m[0].length) };
}

type CitationSource = { n: number; title: string; url: string; snippet?: string };

function parseSources(text: string): Map<number, CitationSource> {
  const map = new Map<number, CitationSource>();
  const idx = text.search(/^\s*##+\s*Sources\s*$/im);
  if (idx < 0) return map;
  const section = text.slice(idx);
  // Match lines like: "1. [Title](url) — snippet" or "1. [Title](url): snippet"
  const re =
    /^\s*(\d+)\.\s*\[([^\]]+)\]\(([^)\s]+)\)(?:\s*[—\-:]\s*(.+))?$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const n = Number(m[1]);
    map.set(n, {
      n,
      title: m[2].trim(),
      url: m[3].trim(),
      snippet: m[4]?.trim(),
    });
  }
  return map;
}

export function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const [citeOn, setCiteOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("oi:cite") === "1";
  });
  const citeRef = useRef(citeOn);
  useEffect(() => {
    citeRef.current = citeOn;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("oi:cite", citeOn ? "1" : "0");
    }
  }, [citeOn]);

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
          // Inject the live citations flag into the JSON body.
          let body = init?.body;
          if (typeof body === "string") {
            try {
              const parsed = JSON.parse(body);
              parsed.cite = citeRef.current;
              body = JSON.stringify(parsed);
            } catch {
              /* leave body as-is */
            }
          }
          return fetch(url, { ...init, headers, body });
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
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

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.size <= 20 * 1024 * 1024);
    if (incoming.length === 0) {
      toast.error("Files must be under 20MB");
      return;
    }
    setAttachments((prev) => [...prev, ...incoming].slice(0, 10));
  };

  const toFileList = (files: File[]): FileList => {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    return dt.files;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading) return;
    sendMessage({
      text: text || "(attached)",
      files: attachments.length ? toFileList(attachments) : undefined,
    });
    setInput("");
    setAttachments([]);
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input not supported on this browser");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };


  const handleEditSave = async (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const text = editValue.trim();
    if (!text) return;
    const truncated = messages.slice(0, idx);
    setMessages(truncated);
    setEditingId(null);
    try {
      await truncateThreadMessages({ data: { threadId, keep: idx } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
      return;
    }
    sendMessage({ text });
  };

  const handleRegenerate = async () => {
    // Drop the trailing assistant message locally + in DB, then regenerate.
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const keep = messages.length - 1;
    setMessages(messages.slice(0, keep));
    try {
      await truncateThreadMessages({ data: { threadId, keep } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate");
      return;
    }
    regenerate();
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
            const rawText = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const { agents, body: text } = isUser
              ? { agents: [] as string[], body: rawText }
              : parseAgents(rawText);
            const fileParts = m.parts.filter(
              (p) =>
                p.type === "file" ||
                (typeof p.type === "string" && p.type.startsWith("file")),
            ) as Array<{ url?: string; mediaType?: string; filename?: string }>;
            return (
              <div
                key={m.id}
                className={cn(
                  "animate-fade-up group flex flex-col",
                  isUser ? "items-end" : "items-start",
                )}
              >
                {!isUser && agents.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {agents.map((a) => (
                      <span
                        key={a}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                          AGENT_STYLES[a] ?? AGENT_STYLES.General,
                        )}
                      >
                        {a} AI
                      </span>
                    ))}
                  </div>
                )}

                {fileParts.length > 0 && (
                  <div
                    className={cn(
                      "mb-2 flex flex-wrap gap-2",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {fileParts.map((f, i) =>
                      f.mediaType?.startsWith("image/") && f.url ? (
                        <img
                          key={i}
                          src={f.url}
                          alt={f.filename ?? "attachment"}
                          className="max-h-56 max-w-[260px] rounded-2xl object-cover shadow-sm"
                        />
                      ) : (
                        <span
                          key={i}
                          className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
                        >
                          <Paperclip className="h-3 w-3" />
                          {f.filename ?? f.mediaType ?? "file"}
                        </span>
                      ),
                    )}
                  </div>
                )}

                {editingId === m.id && isUser ? (
                  <div className="glass w-full max-w-[88%] rounded-3xl p-3">
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
                      "min-w-0 text-[15px] leading-relaxed",
                      isUser
                        ? "max-w-[88%] text-right font-medium text-foreground"
                        : "w-full text-foreground/90",
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{text}</p>
                    ) : (
                      <Markdown text={text} />
                    )}
                    {!isUser &&
                      idx === messages.length - 1 &&
                      status === "streaming" &&
                      !text && <span className="shimmer-text">Thinking…</span>}
                  </div>
                )}

                {!editingId && text && (
                  <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <CopyBtn text={text} />
                    <RememberBtn text={text} threadId={threadId} />
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
                        onClick={handleRegenerate}
                        className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                      >
                        <RotateCcw className="h-3 w-3" /> Regenerate
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="animate-fade-up">
              <span className="shimmer-text text-[15px]">Thinking…</span>
            </div>
          )}

          {error && (
            <div className="text-destructive text-center text-xs">
              {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Floating Liquid Glass composer */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 px-3 pb-4 lg:px-8 lg:pb-6">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          {attachments.length > 0 && (
            <div className="glass mb-2 flex flex-wrap gap-2 rounded-3xl p-2">
              {attachments.map((f, i) => {
                const isImg = f.type.startsWith("image/");
                const url = isImg ? URL.createObjectURL(f) : null;
                return (
                  <div
                    key={`${f.name}-${i}`}
                    className="relative flex items-center gap-2 rounded-2xl bg-white/70 py-1 pr-2 pl-1 text-[12px] shadow-sm"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={f.name}
                        className="h-9 w-9 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="bg-black/6 flex h-9 w-9 items-center justify-center rounded-xl">
                        <Paperclip className="h-4 w-4" />
                      </span>
                    )}
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((p) => p.filter((_, j) => j !== i))
                      }
                      className="hover:bg-black/10 flex h-5 w-5 items-center justify-center rounded-full"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={cn(
              "glass-dock liquid-shine liquid-shine-after flex items-end gap-1 rounded-full p-1.5 transition-all duration-300",
              "focus-within:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25),0_0_0_3px_rgba(255,255,255,0.6)_inset]",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept=".pdf,.txt,.md,.csv,.json,.docx,.xlsx,.pptx"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              hidden
              multiple
              accept="image/*"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <GlassIconBtn
              ariaLabel="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </GlassIconBtn>
            <GlassIconBtn
              ariaLabel="Attach image"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus className="h-[18px] w-[18px]" />
            </GlassIconBtn>

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
              className="placeholder:text-muted-foreground/70 max-h-48 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none"
            />

            <button
              type="button"
              onClick={() => {
                const next = !citeOn;
                setCiteOn(next);
                toast.success(
                  next ? "Citations on — I'll cite sources." : "Citations off",
                );
              }}
              aria-pressed={citeOn}
              aria-label="Toggle citations"
              className={cn(
                "hidden h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition sm:flex",
                citeOn
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
              )}
            >
              <Quote className="h-3.5 w-3.5" />
              Cite
            </button>

            <GlassIconBtn
              ariaLabel={listening ? "Stop listening" : "Voice input"}
              onClick={toggleVoice}
              active={listening}
            >
              {listening ? (
                <MicOff className="h-[18px] w-[18px]" />
              ) : (
                <Mic className="h-[18px] w-[18px]" />
              )}
            </GlassIconBtn>

            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md transition active:scale-90"
                aria-label="Stop"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md transition hover:shadow-lg active:scale-90 disabled:opacity-40 disabled:shadow-none"
                aria-label="Send"
              >
                <ArrowUp className="h-[18px] w-[18px]" />
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

function RememberBtn({ text, threadId }: { text: string; threadId: string }) {
  const [saved, setSaved] = useState(false);
  const saveFn = useServerFn(createMemory);
  return (
    <button
      onClick={async () => {
        try {
          await saveFn({
            data: {
              content: text.slice(0, 500),
              category: "fact",
              source: "manual",
              thread_id: threadId,
            },
          });
          setSaved(true);
          toast.success("Saved to Memory");
          setTimeout(() => setSaved(false), 1500);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save");
        }
      }}
      className="text-muted-foreground hover:bg-black/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
    >
      {saved ? (
        <>
          <Check className="h-3 w-3" /> Remembered
        </>
      ) : (
        <>
          <Brain className="h-3 w-3" /> Remember
        </>
      )}
    </button>
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
  const sources = useMemo(() => parseSources(text), [text]);
  return (
    <div className="prose prose-sm prose-neutral max-w-none [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-black/6 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_p]:my-0 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/90 [&_pre]:p-3 [&_pre]:text-[12.5px] [&_pre_code]:bg-transparent [&_pre_code]:text-white [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-muted-foreground">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            // Detect inline citation marker rendered as [[n]](url) → link text "[n]"
            const raw =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                  ? children.join("")
                  : "";
            const match = /^\[(\d+)\]$/.exec(raw.trim());
            if (match && href) {
              const n = Number(match[1]);
              const src = sources.get(n) ?? {
                n,
                title: href,
                url: href,
                snippet: undefined,
              };
              return <CitationMarker n={n} source={src} />;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function CitationMarker({ n, source }: { n: number; source: CitationSource }) {
  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-[1px] items-center justify-center rounded-full px-1 align-middle text-[10px] font-semibold text-foreground/80 no-underline transition hover:text-foreground hover:-translate-y-[2px]"
          aria-label={`Source ${n}: ${source.title}`}
        >
          {n}
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="glass-strong w-72 rounded-2xl border-black/5 p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
            Source {n}
          </span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open source"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-[13px] font-medium leading-snug text-foreground hover:underline"
        >
          {source.title}
        </a>
        {source.snippet && (
          <p className="text-muted-foreground mt-1.5 line-clamp-4 text-[12px] leading-relaxed">
            {source.snippet}
          </p>
        )}
        <p className="text-muted-foreground/70 mt-2 truncate text-[10.5px]">
          {(() => {
            try {
              return new URL(source.url).hostname.replace(/^www\./, "");
            } catch {
              return source.url;
            }
          })()}
        </p>
      </HoverCardContent>
    </HoverCard>
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
