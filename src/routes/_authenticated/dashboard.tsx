import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { createThread } from "@/lib/threads.functions";
import { Paperclip, Mic, MicOff, ArrowUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home · Vokque" },
      {
        name: "description",
        content:
          "Vokque — a minimal, cinematic AI assistant for questions, writing, code, and everyday help.",
      },
      { property: "og:title", content: "Home · Vokque" },
      {
        property: "og:description",
        content: "Ask Vokque anything — a quiet, minimal AI assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createThread);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const startMut = useMutation({
    mutationFn: async (opts: { text?: string; attach?: boolean }) => {
      const title = opts.text ? opts.text.slice(0, 60) : "New conversation";
      const t = await createFn({ data: { title } });
      if (!t) throw new Error("Something went wrong, please try again.");
      if (opts.text) sessionStorage.setItem(`oi:seed:${t.id}`, opts.text);
      if (opts.attach) sessionStorage.setItem(`vk:attach:${t.id}`, "1");
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (t) navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Something went wrong"),
  });

  const submit = () => {
    const text = draft.trim();
    if (!text || startMut.isPending) return;
    startMut.mutate({ text });
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
      results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
    }) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const tx = r[0].transcript;
        if (r.isFinal) finalText += tx;
        else interim += tx;
      }
      setDraft((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  return (
    <AppShell>
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
        <h1 className="animate-fade-up text-center text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Vokque
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="animate-fade-up mt-10 flex w-full max-w-md items-center gap-1 rounded-full bg-white px-1.5 py-1.5 [animation-delay:100ms]"
        >
          <button
            type="button"
            onClick={() => startMut.mutate({ attach: true })}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black transition active:scale-90"
            aria-label="Attach a file"
          >
            <Paperclip className="h-[19px] w-[19px]" />
          </button>

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Vokque"
            aria-label="Ask Vokque"
            className="min-w-0 flex-1 bg-transparent text-center text-[15px] text-black outline-none placeholder:text-black/70"
          />

          {draft.trim() ? (
            <button
              type="submit"
              disabled={startMut.isPending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black transition active:scale-90 disabled:opacity-40"
              aria-label="Send message"
            >
              <ArrowUp className="h-[20px] w-[20px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleVoice}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black transition active:scale-90"
              aria-label={listening ? "Stop voice input" : "Voice input"}
            >
              {listening ? (
                <MicOff className="h-[19px] w-[19px]" />
              ) : (
                <Mic className="h-[19px] w-[19px]" />
              )}
            </button>
          )}
        </form>
      </div>
    </AppShell>
  );
}
