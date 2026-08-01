import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avenxa" },
      {
        name: "description",
        content:
          "Avenxa — a premium AI assistant by Avenxa Technology.",
      },
    ],
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
