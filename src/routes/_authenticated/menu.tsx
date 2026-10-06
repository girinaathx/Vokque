import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Home,
  Brain,
  Settings as SettingsIcon,
  User as UserIcon,
  Shield,
  Lock,
  Plus,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, createThread } from "@/lib/threads.functions";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menu · Vokque" },
      {
        name: "description",
        content:
          "Vokque menu — jump to Home, Memory, Settings, Account, Private Chat, and your recent conversations.",
      },
      { property: "og:title", content: "Menu · Vokque" },
      {
        property: "og:description",
        content: "Navigate Vokque — home, memory, settings, account, and recent chats.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MenuPage,
});

const ITEMS = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/memory", icon: Brain, label: "Memory" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
  { to: "/account", icon: UserIcon, label: "Account" },
  { to: "/guest", icon: Lock, label: "Private Chat" },
  { to: "/privacy", icon: Shield, label: "Privacy Policy" },
] as const;

function MenuPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const newChat = async () => {
    const th = await createFn({ data: {} });
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (th) navigate({ to: "/chat/$threadId", params: { threadId: th.id } });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    toast.success(t("nav.signOut"));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background px-5"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-full glass text-foreground transition active:scale-90"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo size={26} />
          <button
            onClick={newChat}
            className="flex h-11 w-11 items-center justify-center rounded-full glass text-foreground transition active:scale-90"
            aria-label="New conversation"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground">
          Menu
        </h1>

        <nav className="mt-6 space-y-2.5">
          {ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex h-14 items-center gap-3 rounded-2xl glass px-4 text-[15px] font-medium text-foreground transition active:scale-[0.98]"
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>

        <h2 className="mt-9 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Recent conversations
        </h2>
        <div className="mt-3 space-y-1">
          {threads.length === 0 && (
            <p className="text-[13px] text-muted-foreground">No conversations yet</p>
          )}
          {threads.map((th) => (
            <Link
              key={th.id}
              to="/chat/$threadId"
              params={{ threadId: th.id }}
              className="block truncate py-2.5 text-[15px] text-foreground"
            >
              {th.title}
            </Link>
          ))}
        </div>

        <button
          onClick={signOut}
          className="mt-10 flex h-14 w-full items-center gap-3 rounded-2xl glass px-4 text-[15px] font-medium text-foreground transition active:scale-[0.98]"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {t("nav.signOut")}
        </button>
      </div>
    </div>
  );
}
