import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Avenxa" },
      {
        name: "description",
        content: "Sign in to Avenxa, your premium AI assistant.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
