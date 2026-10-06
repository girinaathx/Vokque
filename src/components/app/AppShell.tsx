import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { APP_HEADER_HEIGHT } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads,
  createThread,
  deleteThread,
  deleteThreadsBulk,
  pinThread,
  renameThread,
  archiveThread,
} from "@/lib/threads.functions";
import {
  Plus,
  Trash2,
  Menu,
  X,
  MoreHorizontal,
  MoreVertical,
  Pin,
  PinOff,
  Pencil,
  Share2,
  Check,
  Search,
  Home,
  Brain,
  Settings as SettingsIcon,
  User as UserIcon,
  Archive,
  LogOut,
  Shield,
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

const DRAWER_MAX = 360;


function useDrawerWidth() {
  const [w, setW] = useState(320);
  useEffect(() => {
    const calc = () =>
      setW(Math.min(Math.round(window.innerWidth * 0.85), DRAWER_MAX));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return w;
}

export function AppShell({
  children,
  activeThreadId,
}: {
  children: ReactNode;
  activeThreadId?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null); // px offset while dragging
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const width = useDrawerWidth();

  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const bulkDeleteFn = useServerFn(deleteThreadsBulk);
  const pinFn = useServerFn(pinThread);
  const renameFn = useServerFn(renameThread);
  const archiveFn = useServerFn(archiveThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (th) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setMobileOpen(false);
      if (th) navigate({ to: "/chat/$threadId", params: { threadId: th.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["threads"] });
      const prev = qc.getQueryData<Thread[]>(["threads"]) ?? [];
      qc.setQueryData<Thread[]>(["threads"], (old) =>
        (old ?? []).filter((x) => x.id !== id),
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
    onMutate: async ({ id, pinned }) => {
      await qc.cancelQueries({ queryKey: ["threads"] });
      const prev = qc.getQueryData<Thread[]>(["threads"]);
      qc.setQueryData<Thread[]>(["threads"], old => old?.map(x => x.id === id ? { ...x, pinned_at: pinned ? new Date().toISOString() : null } : x));
      return { prev };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
    onError: (e, _v, ctx) => { qc.setQueryData(["threads"], ctx?.prev); toast.error(e instanceof Error ? e.message : "Could not pin"); },
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameFn({ data: v }),
    onMutate: async ({ id, title }) => {
      await qc.cancelQueries({ queryKey: ["threads"] });
      const prev = qc.getQueryData<Thread[]>(["threads"]);
      qc.setQueryData<Thread[]>(["threads"], old => old?.map(x => x.id === id ? { ...x, title } : x));
      return { prev };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
    onError: (_e, _v, ctx) => { qc.setQueryData(["threads"], ctx?.prev); toast.error("Couldn't rename"); },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id, archived: true } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["threads"] });
      const prev = qc.getQueryData<Thread[]>(["threads"]) ?? [];
      qc.setQueryData<Thread[]>(["threads"], (old) =>
        (old ?? []).filter((x) => x.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["threads"], ctx.prev);
      toast.error("Couldn't archive chat");
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Chat archived");
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

  /* ---------------- native edge / drawer gestures ---------------- */
  const gesture = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    decided: boolean;
    from: "edge" | "drawer";
    lastX?: number;
    lastT?: number;
    velocity?: number;
  } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const tch = e.touches[0];
      if (!tch) return;
      if (!mobileOpen && tch.clientX <= 28) {
        gesture.current = {
          startX: tch.clientX,
          startY: tch.clientY,
          active: true,
          decided: false,
          from: "edge",
        };
      } else if (mobileOpen) {
        gesture.current = {
          startX: tch.clientX,
          startY: tch.clientY,
          active: true,
          decided: false,
          from: "drawer",
        };
      }
    },
    [mobileOpen],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const g = gesture.current;
      const tch = e.touches[0];
      if (!g?.active || !tch) return;
      const dx = tch.clientX - g.startX;
      const dy = tch.clientY - g.startY;
      if (!g.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // vertical scroll wins — never interfere
          gesture.current = null;
          return;
        }
        g.decided = true;
        g.lastX = tch.clientX;
        g.lastT = performance.now();
        g.velocity = 0;
      }
      // px per ms, smoothed — used for flick / velocity-based completion
      const now = performance.now();
      const dt = Math.max(1, now - (g.lastT ?? now));
      const instant = (tch.clientX - (g.lastX ?? tch.clientX)) / dt;
      g.velocity = (g.velocity ?? 0) * 0.7 + instant * 0.3;
      g.lastX = tch.clientX;
      g.lastT = now;

      if (g.from === "edge") {
        setDrag(Math.max(0, Math.min(width, dx)));
      } else {
        setDrag(Math.max(0, Math.min(width, width + dx)));
      }
    },
    [width],
  );

  const endGesture = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.decided) {
      setDrag(null);
      return;
    }
    const v = g.velocity ?? 0; // px/ms; >0 = moving right
    setDrag((d) => {
      const offset = d ?? 0;
      // Fast flick wins over distance; otherwise snap at 40%.
      if (v > 0.4) setMobileOpen(true);
      else if (v < -0.4) setMobileOpen(false);
      else setMobileOpen(offset > width * 0.4);
      return null;
    });
  }, [width]);


  const dragging = drag !== null;
  const progress = dragging ? (drag as number) / width : mobileOpen ? 1 : 0;
  const drawerVisible = mobileOpen || dragging;

  const sidebarProps = {
    threads,
    activeThreadId,
    onDelete: (id: string) => deleteMut.mutate(id),
    onBulkDelete: (ids: string[]) => bulkDeleteMut.mutate(ids),
    onPin: (id: string, pinned: boolean) => pinMut.mutate({ id, pinned }),
    onRename: (id: string, title: string) => renameMut.mutate({ id, title }),
    onArchive: (id: string) => archiveMut.mutate(id),
    onNewChat: () => createMut.mutate(),
    onSignOut: handleSignOut,
    closeMobile: () => setMobileOpen(false),
    t,
  };

  return (
    <div
      className="relative flex min-h-[100dvh] min-w-0 overflow-x-clip"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endGesture}
      onTouchCancel={endGesture}
    >
      {drawerVisible && <button type="button" className="fixed inset-0 z-40 bg-background/70" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      {drawerVisible && <aside className="fixed inset-y-0 left-0 z-50 w-[min(85vw,360px)]" style={{ transform: `translateX(${(progress - 1) * 100}%)`, transition: dragging ? "none" : "transform 220ms cubic-bezier(0.32,0.72,0,1)" }}><Sidebar {...sidebarProps} mobile /></aside>}

      {/* Fixed app header — logo always perfectly centered */}
      <header
        className="pointer-events-none fixed inset-x-0 z-40 flex items-center px-4"
        style={{
          top: "env(safe-area-inset-top, 0px)",
          height: APP_HEADER_HEIGHT,
        }}
      >
        <Link
          to="/menu"
          onClick={(e) => { e.preventDefault(); setMobileOpen(true); }}
          className="glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-foreground transition active:scale-90"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </Link>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
          <Logo size={26} />
        </div>

        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="glass pointer-events-auto ml-auto flex h-11 w-11 items-center justify-center rounded-full text-foreground transition active:scale-90 disabled:opacity-50"
          aria-label={t("nav.newChat")}
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>


      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

/* ================================================================== */

function Sidebar({
  threads,
  activeThreadId,
  onDelete,
  onBulkDelete,
  onPin,
  onRename,
  onArchive,
  onNewChat,
  onSignOut,
  closeMobile,
  mobile,
  t,
}: {
  threads: Thread[];
  activeThreadId?: string;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onPin: (id: string, pinned: boolean) => void;
  onRename: (id: string, title: string) => void;
  onArchive: (id: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  closeMobile: () => void;
  mobile?: boolean;
  t: (k: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((x) => x.title.toLowerCase().includes(q));
  }, [threads, query]);

  const pinnedList = filtered.filter((x) => x.pinned_at);
  const others = filtered.filter((x) => !x.pinned_at);

  type Row =
    | { kind: "label"; key: string; text: string }
    | { kind: "thread"; key: string; thread: Thread };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (pinnedList.length) {
      out.push({ kind: "label", key: "l-pin", text: "Pinned" });
      pinnedList.forEach((th) =>
        out.push({ kind: "thread", key: th.id, thread: th }),
      );
    }
    if (others.length) {
      out.push({ kind: "label", key: "l-recent", text: t("nav.recent") });
      others.forEach((th) =>
        out.push({ kind: "thread", key: th.id, thread: th }),
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "label" ? 28 : 44),
    overscan: 12,
  });

  const inSelection = selection.size > 0;
  const canPinMore = pinnedList.length < 5;

  const toggleSelect = (id: string) =>
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelection(new Set());

  return (
    <>
      <div
        className={cn(
          "bg-background border-border flex h-full flex-col overflow-hidden",
          mobile ? "rounded-r-3xl border-r" : "rounded-3xl border",
        )}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        }}
      >

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <Link
            to="/dashboard"
            onClick={closeMobile}
            className="flex min-w-0 flex-1 items-center gap-2.5"
          >
            <Logo size={26} />
            <span className="truncate text-[17px] font-semibold tracking-tight text-foreground">
              {t("brand.name")}
            </span>
          </Link>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="hover:bg-foreground/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90"
            aria-label="Search chats"
          >
            <Search className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="hover:bg-foreground/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-menu">
              <DropdownMenuItem
                onClick={() => {
                  onNewChat();
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> {t("nav.newChat")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" onClick={closeMobile}>
                  <SettingsIcon className="mr-2 h-4 w-4" /> {t("nav.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/privacy" onClick={closeMobile}>
                  <Shield className="mr-2 h-4 w-4" /> {t("nav.privacy")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="mr-2 h-4 w-4" /> {t("nav.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        {(searchOpen || query) && (
          <div className="animate-fade-in-soft px-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-70" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="bg-foreground/8 text-foreground w-full rounded-full py-2.5 pr-3 pl-9 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="px-2.5 pb-1">
          <NavItem to="/dashboard" icon={Home} label={t("nav.home")} onClick={closeMobile} exact />
          <NavItem to="/memory" icon={Brain} label={t("nav.memory")} onClick={closeMobile} />
          <NavItem to="/settings" icon={SettingsIcon} label={t("nav.settings")} onClick={closeMobile} />
          <NavItem to="/account" icon={UserIcon} label="Account" onClick={closeMobile} />
        </nav>

        {/* Selection toolbar */}
        {inSelection && (
          <div className="bg-foreground/8 animate-fade-in-soft mx-3 mb-2 flex items-center justify-between rounded-2xl px-3 py-2">
            <span className="text-xs font-medium">{selection.size} selected</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setConfirmDelete({
                    ids: Array.from(selection),
                    label: `Delete ${selection.size} conversation${selection.size === 1 ? "" : "s"}?`,
                  })
                }
                className="bg-destructive text-destructive-foreground flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition active:scale-95"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
              <button
                onClick={clearSelection}
                className="hover:bg-foreground/10 flex h-7 w-7 items-center justify-center rounded-full"
                aria-label="Cancel selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Chat history — virtualized */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2.5">
          {rows.length === 0 && (
            <div className="text-muted-foreground px-3 py-6 text-center text-xs">
              {query ? `No chats match "${query}"` : "No conversations yet"}
            </div>
          )}
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const row = rows[v.index];
              if (!row) return null;
              return (
                <div
                  key={row.key}
                  ref={virtualizer.measureElement}
                  data-index={v.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${v.start}px)`,
                  }}
                >
                  {row.kind === "label" ? (
                    <div className="text-muted-foreground mt-2 mb-1 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      {row.text}
                    </div>
                  ) : (
                    <ThreadRow
                      thread={row.thread}
                      active={activeThreadId === row.thread.id}
                      selected={selection.has(row.thread.id)}
                      selectionMode={inSelection}
                      onSelect={() => toggleSelect(row.thread.id)}
                      onOpen={closeMobile}
                      onPin={onPin}
                      onRename={onRename}
                      onArchive={onArchive}
                      onDeleteRequest={(id, title) =>
                        setConfirmDelete({ ids: [id], label: `Delete "${title}"?` })
                      }
                      canPinMore={canPinMore}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>



      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent className="glass-menu rounded-lg">
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
                if (confirmDelete.ids.length === 1) onDelete(confirmDelete.ids[0]);
                else onBulkDelete(confirmDelete.ids);
                clearSelection();
                setConfirmDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  onClick,
  exact,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  onClick: () => void;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeOptions={{ exact: !!exact }}
      className="text-foreground hover:bg-foreground/8 data-[status=active]:bg-foreground/10 flex h-[54px] items-center gap-3 rounded-2xl px-3 text-[15px] font-normal transition-colors duration-200 data-[status=active]:font-semibold"
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
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
  onArchive,
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
  onArchive: (id: string) => void;
  onDeleteRequest: (id: string, title: string) => void;
  canPinMore: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clearLongPress = () => { if (longPress.current) clearTimeout(longPress.current); longPress.current = null; };
  const swipe = useRef<{ x: number; y: number; decided: boolean } | null>(null);
  const isPinned = !!thread.pinned_at;

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
      /* cancelled */
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const tch = e.touches[0];
    if (!tch || selectionMode || editing) return;
    longPressed.current = false;
    swipe.current = { x: tch.clientX, y: tch.clientY, decided: false };
    clearLongPress();
    longPress.current = setTimeout(() => { longPressed.current = true; swipe.current = null; setMenuOpen(true); }, 550);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = swipe.current;
    const tch = e.touches[0];
    if (!g || !tch) return;
    const dx = tch.clientX - g.x;
    const dy = tch.clientY - g.y;
    if (!g.decided) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      clearLongPress();
      if (Math.abs(dy) >= Math.abs(dx)) {
        swipe.current = null;
        return;
      }
      g.decided = true;
      setSwiping(true);
      e.stopPropagation();
    }
    e.stopPropagation();
    setOffset(Math.max(-120, Math.min(120, dx)));
  };
  const onTouchEnd = () => {
    clearLongPress();
    const g = swipe.current;
    swipe.current = null;
    setSwiping(false);
    const dx = offset;
    setOffset(0);
    if (!g?.decided) return;
    if (dx <= -80) onDeleteRequest(thread.id, thread.title);
    else if (dx >= 80) {
      if (isPinned || canPinMore) onPin(thread.id, !isPinned);
      else toast.error("You can pin up to 5 chats.");
    }
  };

  return (
    <div className="group relative">
      {/* swipe action hints */}
      {offset !== 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-2xl px-4">
          <span className="text-foreground/70 text-[11px] font-semibold">
            {isPinned ? "Unpin" : "Pin"}
          </span>
          <span className="text-destructive text-[11px] font-semibold">Delete</span>
        </div>
      )}

      {editing ? (
        <div className="bg-foreground/8 flex items-center gap-1 rounded-2xl px-2 py-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="text-foreground flex-1 bg-transparent text-sm outline-none"
          />
          <button
            onClick={commitRename}
            className="hover:bg-foreground/10 flex h-6 w-6 items-center justify-center rounded-full"
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : selectionMode ? (
        <button
          onClick={onSelect}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm transition",
            selected ? "bg-foreground/15 font-medium" : "hover:bg-foreground/8",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/40",
            )}
          >
            {selected && <Check className="h-3 w-3" />}
          </span>
          <span className="truncate">{thread.title}</span>
        </button>
      ) : (
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          style={{
            transform: `translate3d(${offset}px,0,0)`,
            transition: swiping ? "none" : "transform 220ms cubic-bezier(0.32,0.72,0,1)",
          }}
          className={cn(
            "relative flex items-center gap-1 rounded-2xl pr-1 transition-colors",
            active ? "bg-foreground/10" : "hover:bg-foreground/8",
          )}
        >
          <Link
            to="/chat/$threadId"
            params={{ threadId: thread.id }}
            onClick={(e) => { if (longPressed.current) { e.preventDefault(); longPressed.current = false; return; } onOpen(); }}
            className={cn(
              "text-foreground flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm",
              active ? "font-semibold" : "font-normal",
            )}
          >
            {isPinned && <Pin className="h-3.5 w-3.5 shrink-0 opacity-80" />}
            <span className="truncate">{thread.title}</span>
          </Link>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:opacity-80"
                aria-label="Chat options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-menu">
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
              <DropdownMenuItem onClick={() => onArchive(thread.id)}>
                <Archive className="mr-2 h-3.5 w-3.5" /> Archive
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
    </div>
  );
}
