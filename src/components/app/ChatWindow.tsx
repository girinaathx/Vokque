import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { truncateThreadMessages } from "@/lib/threads.functions";
import {
  ArrowUp,
  Copy,
  Check,
  RotateCcw,
  Square,
  Pencil,
  Mic,
  MicOff,
  Plus,
  Brain,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { createMemory } from "@/lib/memories.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

export function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const { t } = useTranslation();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          threadId,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          clientNow: new Date().toISOString(),
        },
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
      onError: () => toast.error("Unable to contact OpenAI. Please try again."),
    });

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  // Auto-grow textarea (ChatGPT-style): 1 line → up to 8 lines, then scroll
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const lineHeight = 22; // px
    const maxHeight = lineHeight * 8;
    const next = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  // Keep transcript bottom-padding equal to composer height
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el || !scrollRef.current) return;
    const obs = new ResizeObserver(() => {
      const h = el.offsetHeight;
      scrollRef.current?.style.setProperty("padding-bottom", `${h + 32}px`);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
    rec.onresult = (e: {
      results: ArrayLike<
        ArrayLike<{ transcript: string }> & { isFinal: boolean }
      >;
    }) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const tx = r[0].transcript;
        if (r.isFinal) finalText += tx;
        else interim += tx;
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
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
      return;
    }
    sendMessage({ text });
  };

  const handleRegenerate = async () => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const keep = messages.length - 1;
    setMessages(messages.slice(0, keep));
    try {
      await truncateThreadMessages({ data: { threadId, keep } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
      return;
    }
    regenerate();
  };

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-1 flex-col">
      {/* Top liquid-glass fade — messages dissolve under floating buttons */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-24 bg-gradient-to-b from-background via-background/70 to-transparent backdrop-blur-md [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-20 lg:px-8 lg:pt-24 [mask-image:linear-gradient(to_bottom,transparent_0,black_72px,black_calc(100%-96px),transparent_100%)]"
        style={{ paddingBottom: "180px" }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {messages.length === 0 && (
            <EmptyState onPick={(tx) => sendMessage({ text: tx })} />
          )}

          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
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
                          className="max-h-56 max-w-[260px] rounded-2xl object-cover"
                        />
                      ) : (
                        <span
                          key={i}
                          className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
                        >
                          <Plus className="h-3 w-3" />
                          {f.filename ?? f.mediaType ?? "file"}
                        </span>
                      ),
                    )}
                  </div>

                )}

                {editingId === m.id && isUser ? (
                  <div className="glass w-full max-w-[88%] rounded-2xl p-3">
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
                        className="hover:bg-foreground/5 rounded-full px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEditSave(m.id)}
                        className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "min-w-0 text-[15.5px] leading-relaxed",
                      isUser
                        ? "max-w-[88%] whitespace-pre-wrap text-right"
                        : "w-full max-w-full text-left",
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
                      !text && <span className="shimmer-text">{t("chat.thinking")}</span>}
                  </div>
                )}

                {!editingId && text && (
                  <div
                    className={cn(
                      "mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    <CopyBtn text={text} />
                    <RememberBtn text={text} threadId={threadId} />
                    {isUser && (
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditValue(text);
                        }}
                        className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                      >
                        <Pencil className="h-3 w-3" /> {t("chat.edit")}
                      </button>
                    )}
                    {!isUser && idx === messages.length - 1 && !isLoading && (
                      <button
                        onClick={handleRegenerate}
                        className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                      >
                        <RotateCcw className="h-3 w-3" /> {t("chat.regenerate")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="animate-fade-up">
              <span className="shimmer-text text-[15px]">{t("chat.thinking")}</span>
            </div>
          )}

          {error && (
            <div className="text-destructive text-center text-xs">
              {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Fixed composer — matte, no reflections */}
      <div
        ref={composerRef}
        className="pointer-events-none fixed right-0 bottom-0 left-0 z-30 px-3 lg:left-72 lg:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", paddingTop: "8px" }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          {attachments.length > 0 && (
            <div className="glass mb-2 flex flex-wrap gap-2 rounded-2xl p-2">
              {attachments.map((f, i) => {
                const isImg = f.type.startsWith("image/");
                const url = isImg ? URL.createObjectURL(f) : null;
                return (
                  <div
                    key={`${f.name}-${i}`}
                    className="bg-foreground/5 relative flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 text-[12px]"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={f.name}
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="bg-foreground/5 flex h-9 w-9 items-center justify-center rounded-lg">
                        <Plus className="h-4 w-4" />
                      </span>
                    )}
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((p) => p.filter((_, j) => j !== i))
                      }
                      className="hover:bg-foreground/10 flex h-5 w-5 items-center justify-center rounded-full"
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
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/70 px-1.5 py-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.xlsx,.pptx"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <IconBtn
              ariaLabel={t("chat.attach")}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-[20px] w-[20px]" />
            </IconBtn>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                // Ensure the latest message stays visible when the keyboard opens.
                setTimeout(() => {
                  scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }, 250);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={1}
              placeholder={t("chat.placeholder")}
              className="placeholder:text-muted-foreground/60 flex-1 resize-none self-center bg-transparent px-2 py-2 text-[15.5px] leading-[22px] outline-none"
              style={{
                minHeight: "22px",
                maxHeight: "132px",
                overflowX: "hidden",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            />

            {!input.trim() && attachments.length === 0 && (
              <IconBtn
                ariaLabel={listening ? t("chat.voiceStop") : t("chat.voice")}
                onClick={toggleVoice}
                active={listening}
              >
                {listening ? (
                  <MicOff className="h-[19px] w-[19px]" />
                ) : (
                  <Mic className="h-[19px] w-[19px]" />
                )}
              </IconBtn>
            )}

            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90"
                aria-label={t("chat.stop")}
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:pointer-events-none disabled:opacity-0"
                aria-label={t("chat.send")}
                style={{ transition: "opacity 150ms ease" }}
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </button>
            )}
          </form>

          <p className="text-muted-foreground/60 mt-2 text-center text-[10px]">
            {t("chat.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}

function RememberBtn({ text, threadId }: { text: string; threadId: string }) {
  const [saved, setSaved] = useState(false);
  const { t } = useTranslation();
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
      className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
    >
      {saved ? (
        <>
          <Check className="h-3 w-3" /> {t("chat.remembered")}
        </>
      ) : (
        <>
          <Brain className="h-3 w-3" /> {t("chat.remember")}
        </>
      )}
    </button>
  );
}

function IconBtn({
  ariaLabel,
  onClick,
  active,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90",
        active
          ? "bg-destructive text-destructive-foreground"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" /> {t("chat.copied")}
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> {t("chat.copy")}
        </>
      )}
    </button>
  );
}

function normalizeMath(input: string) {
  // Accept \( ... \) and \[ ... \] and convert to $ / $$ so remark-math sees them.
  return input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n\n$$${body}$$\n\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);
}

function Markdown({ text }: { text: string }) {
  // Strip internal routing comments like <!--agents:General,Coding--> so they never render.
  const clean = normalizeMath(text.replace(/<!--\s*agents:[^>]*-->\s*/gi, ""));
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_p]:my-0 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/90 [&_pre]:p-3 [&_pre]:text-[12.5px] [&_pre_code]:bg-transparent [&_pre_code]:text-white [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-muted-foreground [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex]:text-[1.02em]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}


function EmptyState({ onPick: _onPick }: { onPick: (t: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-up flex flex-col items-center pt-24 text-center">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {t("chat.emptyTitle")}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">
        {t("chat.emptySubtitle")}
      </p>
    </div>
  );
}

