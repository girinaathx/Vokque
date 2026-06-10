import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Open Intelligence" },
      {
        name: "description",
        content:
          "Your everyday AI companion — premium Liquid Glass design, built for travel, fitness, productivity, and life.",
      },
    ],
  }),
  component: SplashIndex,
});

function SplashIndex() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"splash" | "leaving">("splash");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      // Hold splash for a beat for the animation to play
      await new Promise((r) => setTimeout(r, 1400));
      if (cancelled) return;
      setPhase("leaving");
      await new Promise((r) => setTimeout(r, 420));
      if (cancelled) return;
      if (data.session) {
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/auth" });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      <div
        className={`flex flex-col items-center transition-all duration-500 ${
          phase === "leaving"
            ? "scale-110 opacity-0 blur-md"
            : "scale-100 opacity-100"
        }`}
      >
        <div className="animate-lightning animate-float-slow">
          <Logo size={108} glow />
        </div>
        <h1 className="animate-fade-up mt-8 text-3xl font-semibold tracking-tight [animation-delay:200ms]">
          Open Intelligence
        </h1>
        <p className="animate-fade-up mt-2 text-sm text-muted-foreground [animation-delay:380ms]">
          Your everyday AI companion
        </p>
        <div className="animate-fade-up mt-10 flex gap-1 [animation-delay:600ms]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-black/30"
              style={{
                animation: `pulse-glow 1.2s ${i * 0.18}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
