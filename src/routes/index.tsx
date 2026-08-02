import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avenxa — Your Everyday AI Assistant" },
      {
        name: "description",
        content:
          "Avenxa is a premium AI assistant by Avenxa Technology for study, work, math, code, and everyday questions.",
      },
      { property: "og:title", content: "Avenxa — Your Everyday AI Assistant" },
      {
        property: "og:description",
        content:
          "A premium AI assistant for study, work, math, code, and everyday questions.",
      },
      { property: "og:url", content: "https://feyncloud.lovable.app/" },
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black">
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
