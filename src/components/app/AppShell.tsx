import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads,
  createThread,
  deleteThread,
} from "@/lib/threads.functions";
import {
  Plus,
  MessageSquare,
  Trash2,
  LogOut,
  Menu,
  X,
  Home,
  Brain,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export function AppShell({
  children,
  activeThreadId,
}: {
  children: ReactNode;
  activeThreadId?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setMobileOpen(false);
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (id === activeThreadId) navigate({ to: "/dashboard" });
    },
  });

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
    toast.success(t("nav.signOut"));
  };

  return (
    <div className="relative flex min-h-[100dvh]">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col p-4 lg:flex">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onNew={() => createMut.mutate()}
          onDelete={(id) => deleteMut.mutate(id)}
          onSignOut={handleSignOut}
          creating={createMut.isPending}
          closeMobile={() => setMobileOpen(false)}
          t={t}
        />
      </aside>

      {/* Mobile top bar — dark matte liquid glass (no shine) */}
      <header className="fixed top-2.5 right-3 left-3 z-40 lg:hidden">
        <div className="glass-dock flex items-center justify-between rounded-full px-2 py-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="glass flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="text-sm font-semibold tracking-tight">
              {t("brand.name")}
            </span>
          </Link>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="glass flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-50"
            aria-label={t("nav.newChat")}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer — single floating panel, no nested frame */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in-soft absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-glass-pop absolute top-3 bottom-3 left-3 w-[min(82vw,300px)]">
            <div className="relative h-full">
              <button
                onClick={() => setMobileOpen(false)}
                className="hover:bg-foreground/10 absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <Sidebar
                threads={threads}
                activeThreadId={activeThreadId}
                onNew={() => createMut.mutate()}
                onDelete={(id) => deleteMut.mutate(id)}
                onSignOut={handleSignOut}
                creating={createMut.isPending}
                closeMobile={() => setMobileOpen(false)}
                t={t}
              />
            </div>
          </div>
        </div>
      )}


      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

type Thread = { id: string; title: string; updated_at: string };

function Sidebar({
  threads,
  activeThreadId,
  onNew,
  onDelete,
  onSignOut,
  creating,
  closeMobile,
  t,
}: {
  threads: Thread[];
  activeThreadId?: string;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
  creating: boolean;
  closeMobile: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="glass-strong flex h-full flex-col rounded-3xl p-4">
      <Link
        to="/dashboard"
        onClick={closeMobile}
        className="mb-4 flex items-center gap-2.5 px-1.5"
      >
        <Logo size={28} />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">
            {t("brand.name")}
          </div>
          <div className="text-muted-foreground text-[10px]">
            {t("brand.tagline")}
          </div>
        </div>
      </Link>

      <button
        onClick={onNew}
        disabled={creating}
        className="glass mb-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {t("nav.newChat")}
      </button>

      <Link
        to="/dashboard"
        onClick={closeMobile}
        className={cn(
          "mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
          !activeThreadId
            ? "bg-foreground/8 font-medium"
            : "text-muted-foreground hover:bg-foreground/5",
        )}
      >
        <Home className="h-4 w-4" />
        {t("nav.home")}
      </Link>
      <Link
        to="/memory"
        onClick={closeMobile}
        className="text-muted-foreground hover:bg-foreground/5 mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
      >
        <Brain className="h-4 w-4" />
        {t("nav.memory")}
      </Link>
      <Link
        to="/settings"
        onClick={closeMobile}
        className="text-muted-foreground hover:bg-foreground/5 mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
      >
        <SettingsIcon className="h-4 w-4" />
        {t("nav.settings")}
      </Link>
      <Link
        to="/privacy"
        onClick={closeMobile}
        className="text-muted-foreground hover:bg-foreground/5 mb-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
      >
        <ShieldCheck className="h-4 w-4" />
        {t("nav.privacy")}
      </Link>

      <div className="text-muted-foreground mt-2 mb-1 px-3 text-[10px] font-semibold tracking-wider uppercase">
        {t("nav.recent")}
      </div>
      <nav className="-mr-2 flex-1 overflow-y-auto pr-1">
        {threads.length === 0 && (
          <div className="text-muted-foreground px-3 py-6 text-center text-xs">
            —
          </div>
        )}
        <ul className="space-y-0.5">
          {threads.map((thr) => (
            <li key={thr.id} className="group relative">
              <Link
                to="/chat/$threadId"
                params={{ threadId: thr.id }}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm transition",
                  activeThreadId === thr.id
                    ? "bg-foreground/8 font-medium"
                    : "hover:bg-foreground/5",
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{thr.title}</span>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm("Delete this conversation?")) onDelete(thr.id);
                }}
                className="hover:bg-foreground/10 absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg opacity-0 transition group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <button
        onClick={onSignOut}
        className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
      >
        <LogOut className="h-4 w-4" />
        {t("nav.signOut")}
      </button>
    </div>
  );
}

