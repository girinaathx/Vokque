import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { guestStore } from "@/lib/guest";
import { toast } from "sonner";
import { Loader2, Mail, Lock, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Avenxa" },
      {
        name: "description",
        content: "Sign in to Avenxa, your premium AI assistant.",
      },
      { property: "og:title", content: "Sign in · Avenxa" },
      {
        property: "og:description",
        content: "Sign in to Avenxa with Google, email, or continue as guest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? t("errors.generic"));
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGuest = () => {
    guestStore.activate();
    navigate({ to: "/guest" });
  };


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
        toast.success(t("auth.welcomeToast"));
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success(t("auth.welcomeBackToast"));
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground absolute top-6 left-6 text-xs"
      >
        {t("auth.back")}
      </Link>

      <div className="animate-glass-pop w-full max-w-md">
        <div className="mb-7 flex flex-col items-center">
          <Logo size={56} glow />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {mode === "signin" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {mode === "signin"
              ? t("auth.signInSubtitle")
              : t("auth.signUpSubtitle")}
          </p>
        </div>

        <div className="glass-strong rounded-3xl p-7">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="glass-thin focus-within:ring-foreground/20 flex items-center gap-2.5 rounded-2xl px-4 py-3 ring-1 ring-transparent transition focus-within:ring-2">
              <Mail className="text-muted-foreground h-4 w-4" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.email")}
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
                placeholder={t("auth.password")}
                className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm outline-none"
              />
            </div>

            {mode === "signin" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  {t("auth.forgot")}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-medium transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" ? (
                t("auth.signIn")
              ) : (
                t("auth.signUp")
              )}
            </button>
          </form>

          <p className="text-muted-foreground mt-5 text-center text-xs">
            {mode === "signin" ? t("auth.newHere") : t("auth.haveAccount")}{" "}
            <button
              type="button"
              onClick={() =>
                setMode(mode === "signin" ? "signup" : "signin")
              }
              className="text-foreground font-medium hover:underline"
            >
              {mode === "signin" ? t("auth.signUp") : t("auth.signIn")}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
