import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vokque — Your Everyday AI Assistant" },
      {
        name: "description",
        content:
          "Vokque is a premium AI assistant by Vokque Technology for study, work, math, code, and everyday questions.",
      },
      { property: "og:title", content: "Vokque — Your Everyday AI Assistant" },
      {
        property: "og:description",
        content:
          "A premium AI assistant for study, work, math, code, and everyday questions.",
      },
      { property: "og:url", content: "https://feyncloud.lovable.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://feyncloud.lovable.app/" }],
  }),
  component: SplashIndex,
});

function SplashIndex() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      await new Promise((r) => setTimeout(r, 1100));
      if (cancelled) return;
      setPhase("out");
      await new Promise((r) => setTimeout(r, 420));
      if (cancelled) return;
      navigate({ to: data.session ? "/dashboard" : "/auth" });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background">
      <h1 className="sr-only">Vokque — Your Everyday AI Assistant</h1>
      <div
        className={`transition-all duration-500 ease-out ${
          phase === "out"
            ? "scale-110 opacity-0 blur-md"
            : "scale-100 opacity-100"
        }`}
      >
        <Logo size={112} />
      </div>
    </main>
  );
}
