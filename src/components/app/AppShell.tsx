import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads,
  createThread,
  deleteThread,
  deleteThreadsBulk,
  pinThread,
  renameThread,
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
  UserCircle2,


  
  Search,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Share2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Thread = {
  id: string;
  title: string;
  updated_at: string;
  pinned_at?: string | null;
};

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
  const bulkDeleteFn = useServerFn(deleteThreadsBulk);
  const pinFn = useServerFn(pinThread);
  const renameFn = useServerFn(renameThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setMobileOpen(false);
      if (t) navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["threads"] });
      const prev = qc.getQueryData<Thread[]>(["threads"]) ?? [];
      qc.setQueryData<Thread[]>(["threads"], (old) =>
        (old ?? []).filter((t) => t.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["threads"], ctx.prev);
      toast.error("Couldn't delete chat");
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (id === activeThreadId) navigate({ to: "/dashboard" });
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteFn({ data: { ids } }),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (activeThreadId && ids.includes(activeThreadId)) {
        navigate({ to: "/dashboard" });
      }
      toast.success(`Deleted ${ids.length} chat${ids.length === 1 ? "" : "s"}`);
    },
  });

  const pinMut = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not pin"),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
    onError: () => toast.error("Couldn't rename"),
  });

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
    toast.success(t("nav.signOut"));
  };

  const sidebarProps = {
    threads,
    activeThreadId,
    onNew: () => createMut.mutate(),
    onDelete: (id: string) => deleteMut.mutate(id),
    onBulkDelete: (ids: string[]) => bulkDeleteMut.mutate(ids),
    onPin: (id: string, pinned: boolean) => pinMut.mutate({ id, pinned }),
    onRename: (id: string, title: string) => renameMut.mutate({ id, title }),
    onSignOut: handleSignOut,
    creating: createMut.isPending,
    closeMobile: () => setMobileOpen(false),
    t,
  };

  return (
    <div className="relative flex min-h-[100dvh]">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col p-4 lg:flex">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Mobile floating glass buttons — no top bar */}
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex items-center justify-between px-4 lg:hidden"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-50"
          aria-label={t("nav.newChat")}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in-soft absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-glass-pop absolute top-3 bottom-3 left-3 w-[min(84vw,320px)]">
            <div className="relative h-full">
              <button
                onClick={() => setMobileOpen(false)}
                className="hover:bg-foreground/10 absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <Sidebar {...sidebarProps} />
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}


function Sidebar({
  threads,
  activeThreadId,
  onNew,
  onDelete,
  onBulkDelete,
  onPin,
  onRename,
  onSignOut,
  creating,
  closeMobile,
  t,
}: {
  threads: Thread[];
  activeThreadId?: string;
  onNew: () => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onPin: (id: string, pinned: boolean) => void;
  onRename: (id: string, title: string) => void;
  onSignOut: () => void;
  creating: boolean;
  closeMobile: () => void;
  t: (k: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    label: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  const pinned = filtered.filter((t) => t.pinned_at);
  const others = filtered.filter((t) => !t.pinned_at);

  const inSelection = selection.size > 0;

  const toggleSelect = (id: string) => {
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelection(new Set());

  return (
    <>
      <div className="glass-strong flex h-full flex-col rounded-3xl p-4">
        <Link
          to="/dashboard"
          onClick={closeMobile}
          className="mb-3 flex items-center gap-2.5 px-1.5"
        >
          <Logo size={26} />
          <div className="text-sm font-semibold tracking-tight">
            {t("brand.name")}
          </div>
        </Link>

        {/* Search — directly below brand */}
        <div className="relative mb-3">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="glass w-full rounded-full py-2 pr-3 pl-9 text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <button
          onClick={onNew}
          disabled={creating}
          className="glass mb-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition hover:-translate-y-px active:translate-y-0 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t("nav.newChat")}
        </button>

        <Link
          to="/dashboard"
          onClick={closeMobile}
          className={cn(
            "mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
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
          className="text-muted-foreground hover:bg-foreground/5 mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
        >
          <Brain className="h-4 w-4" />
          {t("nav.memory")}
        </Link>
        <Link
          to="/settings"
          onClick={closeMobile}
          className="text-muted-foreground hover:bg-foreground/5 mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
        >
          <SettingsIcon className="h-4 w-4" />
          {t("nav.settings")}
        </Link>
        <Link
          to="/account"
          onClick={closeMobile}
          className="text-muted-foreground hover:bg-foreground/5 mb-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition"
        >
          <UserCircle2 className="h-4 w-4" />
          Account
        </Link>






        {/* Selection toolbar */}
        {inSelection && (
          <div className="glass animate-fade-in-soft mb-2 flex items-center justify-between rounded-2xl px-3 py-2">
            <span className="text-xs font-medium">
              {selection.size} selected
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setConfirmDelete({
                    ids: Array.from(selection),
                    label: `Delete ${selection.size} conversation${selection.size === 1 ? "" : "s"}?`,
                  })
                }
                className="flex h-7 items-center gap-1 rounded-full bg-destructive px-2.5 text-[11px] font-medium text-destructive-foreground transition active:scale-95"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
              <button
                onClick={clearSelection}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-foreground/10"
                aria-label="Cancel selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <nav className="-mr-2 flex-1 overflow-y-auto pr-1">
          {threads.length === 0 && (
            <div className="text-muted-foreground px-3 py-6 text-center text-xs">
              —
            </div>
          )}

          {pinned.length > 0 && (
            <>
              <SectionLabel>Pinned</SectionLabel>
              <ul className="mb-1 space-y-0.5">
                {pinned.map((thr) => (
                  <ThreadRow
                    key={thr.id}
                    thread={thr}
                    active={activeThreadId === thr.id}
                    selected={selection.has(thr.id)}
                    selectionMode={inSelection}
                    onSelect={() => toggleSelect(thr.id)}
                    onOpen={closeMobile}
                    onPin={onPin}
                    onRename={onRename}
                    onDeleteRequest={(id, title) =>
                      setConfirmDelete({ ids: [id], label: `Delete "${title}"?` })
                    }
                    canPinMore={pinned.length < 5}
                  />
                ))}
              </ul>
            </>
          )}

          {others.length > 0 && (
            <>
              {pinned.length > 0 && <SectionLabel>{t("nav.recent")}</SectionLabel>}
              <ul className="space-y-0.5">
                {others.map((thr) => (
                  <ThreadRow
                    key={thr.id}
                    thread={thr}
                    active={activeThreadId === thr.id}
                    selected={selection.has(thr.id)}
                    selectionMode={inSelection}
                    onSelect={() => toggleSelect(thr.id)}
                    onOpen={closeMobile}
                    onPin={onPin}
                    onRename={onRename}
                    onDeleteRequest={(id, title) =>
                      setConfirmDelete({ ids: [id], label: `Delete "${title}"?` })
                    }
                    canPinMore={pinned.length < 5}
                  />
                ))}
              </ul>
            </>
          )}

          {filtered.length === 0 && query && (
            <div className="text-muted-foreground px-3 py-6 text-center text-xs">
              No chats match "{query}"
            </div>
          )}
        </nav>

      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border-white/10 bg-background/85 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDelete?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.ids.length === 1) {
                  onDelete(confirmDelete.ids[0]);
                } else {
                  onBulkDelete(confirmDelete.ids);
                }
                clearSelection();
                setConfirmDelete(null);
              }}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground mt-2 mb-1 px-3 text-[10px] font-semibold tracking-wider uppercase">
      {children}
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  selected,
  selectionMode,
  onSelect,
  onOpen,
  onPin,
  onRename,
  onDeleteRequest,
  canPinMore,
}: {
  thread: Thread;
  active: boolean;
  selected: boolean;
  selectionMode: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDeleteRequest: (id: string, title: string) => void;
  canPinMore: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const isPinned = !!thread.pinned_at;

  // Long-press to enter selection mode.
  const pressTimer = { current: null as ReturnType<typeof setTimeout> | null };
  const startPress = () => {
    pressTimer.current = setTimeout(() => onSelect(), 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const commitRename = () => {
    const title = draft.trim();
    if (title && title !== thread.title) onRename(thread.id, title);
    setEditing(false);
  };

  const share = async () => {
    const url = `${window.location.origin}/chat/${thread.id}`;
    try {
      if (navigator.share) await navigator.share({ title: thread.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <li className="group relative animate-fade-in-soft">
      {editing ? (
        <div className="flex items-center gap-1 rounded-2xl bg-foreground/5 px-2 py-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button
            onClick={commitRename}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-foreground/10"
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : selectionMode ? (
        <button
          onClick={onSelect}
          onContextMenu={(e) => {
            e.preventDefault();
            onSelect();
          }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-sm transition",
            selected ? "bg-foreground/12 font-medium" : "hover:bg-foreground/5",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/30",
            )}
          >
            {selected && <Check className="h-3 w-3" />}
          </span>
          <span className="truncate">{thread.title}</span>
        </button>
      ) : (
        <div
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            startPress();
          }}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onContextMenu={(e) => {
            e.preventDefault();
            onSelect();
          }}
          className={cn(
            "flex items-center gap-1 rounded-2xl pr-1 transition",
            active ? "bg-foreground/8" : "hover:bg-foreground/5",
          )}
        >
          <Link
            to="/chat/$threadId"
            params={{ threadId: thread.id }}
            onClick={onOpen}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 py-2 text-sm",
              active && "font-medium",
            )}
          >
            {isPinned ? (
              <Pin className="h-3 w-3 shrink-0 opacity-70" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            )}
            <span className="truncate">{thread.title}</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="hover:bg-foreground/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-60 transition hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                aria-label="Chat options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="rounded-2xl border-white/10 bg-background/90 backdrop-blur-2xl"
            >
              <DropdownMenuItem
                onClick={() => {
                  setDraft(thread.title);
                  setEditing(true);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!isPinned && !canPinMore}
                onClick={() => onPin(thread.id, !isPinned)}
              >
                {isPinned ? (
                  <>
                    <PinOff className="mr-2 h-3.5 w-3.5" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 h-3.5 w-3.5" /> Pin
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={share}>
                <Share2 className="mr-2 h-3.5 w-3.5" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSelect}>
                <Check className="mr-2 h-3.5 w-3.5" /> Select
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteRequest(thread.id, thread.title)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
