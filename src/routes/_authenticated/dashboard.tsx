import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { createThread } from "@/lib/threads.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Train,
  Plane,
  CalendarDays,
  Dumbbell,
  BookOpen,
  Compass,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home · FeynCloud" },
      {
        name: "description",
        content:
          "Your personalized home for travel, fitness, productivity, and intelligent conversation.",
      },
    ],
  }),
  component: Dashboard,
});

type Quick = {
  label: string;
  hint: string;
  prompt: string;
  icon: LucideIcon;
};

const QUICK_ACTIONS: Quick[] = [
  {
    label: "Find Train Tickets",
    hint: "Plan your route",
    prompt: "Help me find train tickets. Ask me where I'm going and when.",
    icon: Train,
  },
  {
    label: "Find Flights",
    hint: "Search & compare",
    prompt: "I'd like help finding flights. Ask me the details you need.",
    icon: Plane,
  },
  {
    label: "Plan My Day",
    hint: "A calm schedule",
    prompt: "Help me plan my day. Start by asking what's on my mind.",
    icon: CalendarDays,
  },
  {
    label: "Gym Assistant",
    hint: "Workout & habits",
    prompt:
      "Be my gym assistant. Ask my goals and build me a workout for today.",
    icon: Dumbbell,
  },
  {
    label: "Study Planner",
    hint: "Focus sessions",
    prompt: "Help me plan my study session. Ask what I'm working on.",
    icon: BookOpen,
  },
  {
    label: "Travel Planner",
    hint: "Trips & itineraries",
    prompt:
      "Help me plan a trip. Ask about destination, dates, vibe and budget.",
    icon: Compass,
  },
  {
    label: "Ask Anything",
    hint: "Open conversation",
    prompt: "Hey! What's on your mind today?",
    icon: MessageCircle,
  },
];

function greeting(name?: string) {
  const h = new Date().getHours();
  const part =
    h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createThread);
  const [displayName, setDisplayName] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      const name =
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        data.user?.email?.split("@")[0];
      setDisplayName(name?.split(" ")[0]);
    });
  }, []);

  const startMut = useMutation({
    mutationFn: async (q: Quick | { custom: string }) => {
      const isQuick = "label" in q;
      const title = isQuick ? q.label : q.custom.slice(0, 60);
      const t = await createFn({ data: { title } });
      if (!t) throw new Error("Something went wrong, please try again.");
      const seed = isQuick ? q.prompt : q.custom;
      sessionStorage.setItem(`oi:seed:${t.id}`, seed);
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (t) navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const [draft, setDraft] = useState("");

  return (
    <AppShell>
      <div
        className="mx-auto w-full max-w-3xl px-5 pb-32 lg:pt-14"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}
      >

        <div className="animate-fade-up">
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="font-display mt-1 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            {greeting(displayName)} <span className="inline-block">👋</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-base">
            How are you feeling today? What would you like help with?
          </p>
        </div>

        {/* Composer */}
        <div className="animate-fade-up mt-7 [animation-delay:120ms]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim() || startMut.isPending) return;
              startMut.mutate({ custom: draft.trim() });
            }}
            className="glass-dock flex items-end gap-2 rounded-3xl p-2.5"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) startMut.mutate({ custom: draft.trim() });
                }
              }}
              rows={1}
              placeholder="Ask anything — travel, fitness, planning, life…"
              className="placeholder:text-muted-foreground/70 max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || startMut.isPending}
              className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition hover:opacity-90 active:scale-95 disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUpRight className="h-4.5 w-4.5" />
            </button>
          </form>
        </div>

        {/* Quick actions */}
        <div className="animate-fade-up mt-10 [animation-delay:220ms]">
          <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
            Quick start
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK_ACTIONS.map((q, i) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.label}
                  onClick={() => startMut.mutate(q)}
                  disabled={startMut.isPending}
                  style={{ animationDelay: `${260 + i * 40}ms` }}
                  className="glass animate-fade-up group hover:bg-glass-strong relative flex aspect-square flex-col justify-between rounded-3xl p-4 text-left transition hover:-translate-y-1 hover:shadow-lg active:translate-y-0 disabled:opacity-60"
                >
                  <div className="bg-black/4 flex h-10 w-10 items-center justify-center rounded-2xl transition group-hover:bg-black/8">
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                  <div>
                    <div className="text-sm leading-tight font-semibold tracking-tight">
                      {q.label}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-[11px]">
                      {q.hint}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
