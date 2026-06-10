import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Open Intelligence" },
      {
        name: "description",
        content:
          "Sign in to Open Intelligence, your premium AI companion for travel, fitness, productivity, and life.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome to Open Intelligence");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(
          result.error instanceof Error
            ? result.error.message
            : "Google sign-in failed",
        );
        setOauthLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setOauthLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground absolute top-6 left-6 text-xs"
      >
        ← Back
      </Link>

      <div className="animate-glass-pop w-full max-w-md">
        <div className="mb-7 flex flex-col items-center">
          <Logo size={56} glow />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {mode === "signin"
              ? "Sign in to your AI companion"
              : "Start your journey with Open Intelligence"}
          </p>
        </div>

        <div className="glass-strong rounded-3xl p-7">
          <button
            onClick={handleGoogle}
            disabled={oauthLoading}
            className="glass relative flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium transition hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-60"
          >
            {oauthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/8" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="h-px flex-1 bg-black/8" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="glass-thin focus-within:ring-foreground/20 flex items-center gap-2.5 rounded-2xl px-4 py-3 ring-1 ring-transparent transition focus-within:ring-2">
              <Mail className="text-muted-foreground h-4 w-4" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="glass-thin focus-within:ring-foreground/20 flex items-center gap-2.5 rounded-2xl px-4 py-3 ring-1 ring-transparent transition focus-within:ring-2">
              <Lock className="text-muted-foreground h-4 w-4" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-medium transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="text-muted-foreground mt-5 text-center text-xs">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() =>
                setMode(mode === "signin" ? "signup" : "signin")
              }
              className="text-foreground font-medium hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4c-7 0-13.1 4-16.7 9.9z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.7 40 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2c-.4.4 6.5-4.7 6.5-14.2 0-1.3-.1-2.3-.4-4z"
      />
    </svg>
  );
}
