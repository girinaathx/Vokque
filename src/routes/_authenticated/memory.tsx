import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer, PageHeader } from "@/components/app/PageHeader";
import { copyText } from "@/lib/copy";

import {
  createMemory,
  deleteAllMemories,
  deleteMemoriesBulk,
  deleteMemory,
  exportMemories,
  importMemories,
  listMemories,
  setMemoriesArchived,
  setMemoryPinned,
  updateMemory,
  MEMORY_CATEGORIES,
  type Memory,
  type MemoryCategory,
} from "@/lib/memories.functions";
import {
  Copy,
  Download,
  Upload,
  Plus,
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "Memory · Avenxa" },
      {
        name: "description",
        content:
          "Review, edit, pin, archive, import, export, and delete everything Avenxa remembers about you.",
      },
      { property: "og:title", content: "Memory · Avenxa" },
      {
        property: "og:description",
        content:
          "Full control over your Avenxa memory — edit, pin, archive, import, export, or delete.",
      },
    ],
  }),
  component: MemoryPage,
});

const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  preference: "Preference",
  project: "Project",
  goal: "Goal",
  style: "Style",
  fact: "Fact",
  general: "General",
};

type SortKey = "newest" | "oldest" | "az";

function MemoryPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemories);
  const createFn = useServerFn(createMemory);
  const updateFn = useServerFn(updateMemory);
  const deleteFn = useServerFn(deleteMemory);
  const deleteBulkFn = useServerFn(deleteMemoriesBulk);
  const deleteAllFn = useServerFn(deleteAllMemories);
  const exportFn = useServerFn(exportMemories);
  const importFn = useServerFn(importMemories);
  const pinFn = useServerFn(setMemoryPinned);
  const archiveFn = useServerFn(setMemoriesArchived);

  const { data: memories = [] } = useQuery({
    queryKey: ["memories"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("fact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryCategory>("fact");
  const fileRef = useRef<HTMLInputElement>(null);

  const active = useMemo(
    () => memories.filter((m) => !m.archived_at),
    [memories],
  );
  const archived = useMemo(
    () => memories.filter((m) => m.archived_at),
    [memories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = showArchived ? archived : active;
    const list = base.filter(
      (m) =>
        (filter === "all" || m.category === filter) &&
        (!q ||
          m.content.toLowerCase().includes(q) ||
          (m.title ?? "").toLowerCase().includes(q)),
    );
    const sorted = [...list].sort((a, b) => {
      if (sort === "az") return a.content.localeCompare(b.content);
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "oldest" ? da - db : db - da;
    });
    // Pinned always float to the top.
    return sorted.sort(
      (a, b) => (b.pinned_at ? 1 : 0) - (a.pinned_at ? 1 : 0),
    );
  }, [active, archived, showArchived, query, filter, sort]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories"] });
  const onError = (e: Error) => toast.error(e.message);

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          content: newContent.trim(),
          category: newCategory,
          source: "manual",
        },
      }),
    onSuccess: () => {
      invalidate();
      setNewContent("");
      toast.success("Memory saved");
    },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: (v: {
      id: string;
      content: string;
      title: string | null;
      category: MemoryCategory;
    }) => updateFn({ data: v }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("Updated");
    },
    onError,
  });

  const pinMut = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: invalidate,
    onError,
  });

  const archiveMut = useMutation({
    mutationFn: (v: { ids: string[]; archived: boolean }) =>
      archiveFn({ data: v }),
    onSuccess: () => {
      invalidate();
      setSelected([]);
    },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Memory deleted");
    },
    onError,
  });

  const deleteBulkMut = useMutation({
    mutationFn: (ids: string[]) => deleteBulkFn({ data: { ids } }),
    onSuccess: () => {
      invalidate();
      setSelected([]);
      toast.success("Deleted");
    },
    onError,
  });

  const deleteAllMut = useMutation({
    mutationFn: () => deleteAllFn({ data: undefined as never }),
    onSuccess: () => {
      invalidate();
      setSelected([]);
      toast.success("All memories deleted");
    },
    onError,
  });

  const importMut = useMutation({
    mutationFn: (
      items: { content: string; title?: string | null; category?: MemoryCategory }[],
    ) => importFn({ data: { memories: items } }),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Imported ${r.inserted} ${r.inserted === 1 ? "memory" : "memories"}`);
    },
    onError,
  });

  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stamp = new Date().toISOString().slice(0, 10);

  const handleExportJson = async () => {
    const data = await exportFn({ data: undefined as never });
    download(
      `avenxa-memories-${stamp}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast.success("Exported JSON");
  };

  const handleExportTxt = async () => {
    const data = await exportFn({ data: undefined as never });
    const body = data.memories
      .map(
        (m) =>
          `[${String(m.category).toUpperCase()}] ${m.title ? m.title + " — " : ""}${m.content}`,
      )
      .join("\n");
    download(
      `avenxa-memories-${stamp}.txt`,
      `Avenxa Memories — exported ${stamp}\n\n${body}\n`,
      "text/plain",
    );
    toast.success("Exported TXT");
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      let items: { content: string; title?: string | null; category?: MemoryCategory }[] = [];
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        const raw = Array.isArray(parsed) ? parsed : (parsed.memories ?? []);
        items = raw
          .map((m: { content?: string; title?: string; category?: string }) => ({
            content: String(m.content ?? "").trim(),
            title: m.title ?? null,
            category: (MEMORY_CATEGORIES as readonly string[]).includes(
              m.category ?? "",
            )
              ? (m.category as MemoryCategory)
              : ("general" as MemoryCategory),
          }))
          .filter((m: { content: string }) => m.content.length > 1);
      } else {
        items = text
          .split("\n")
          .map((l) => l.replace(/^\[[^\]]*\]\s*/, "").trim())
          .filter((l) => l.length > 1)
          .map((content) => ({ content, category: "general" as MemoryCategory }));
      }
      if (items.length === 0) {
        toast.error("Nothing to import from that file");
        return;
      }
      importMut.mutate(items.slice(0, 500));
    } catch {
      toast.error("Could not read that file");
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((m) => selected.includes(m.id));

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Memory"
          subtitle="Everything Avenxa remembers about you. Yours to edit, pin, archive, export, or delete — anytime."
        />


        {/* Stats */}
        <div className="animate-fade-up mt-5 grid grid-cols-3 gap-2 [animation-delay:60ms]">
          <Stat label="Saved" value={active.length} />
          <Stat label="Pinned" value={active.filter((m) => m.pinned_at).length} />
          <Stat label="Archived" value={archived.length} />
        </div>

        {/* Add manually */}
        <div className="animate-fade-up glass-strong mt-5 rounded-3xl p-4 [animation-delay:80ms]">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
            Add a memory
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            placeholder="e.g. I prefer vegetarian food when traveling."
            className="placeholder:text-muted-foreground/70 w-full resize-none rounded-2xl bg-foreground/5 p-3 text-[14px] outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CategorySelect value={newCategory} onChange={setNewCategory} />
            <button
              onClick={() => createMut.mutate()}
              disabled={!newContent.trim() || createMut.isPending}
              className="bg-primary text-primary-foreground ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Save memory
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="animate-fade-up mt-6 flex flex-wrap items-center gap-2 [animation-delay:140ms]">
          <div className="glass flex min-w-[180px] flex-1 items-center gap-2 rounded-full px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories…"
              className="placeholder:text-muted-foreground/70 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="glass rounded-full px-3 py-2 text-xs font-medium outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A–Z</option>
          </select>
          <button
            onClick={handleExportJson}
            className="glass hover:bg-foreground/5 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> JSON
          </button>
          <button
            onClick={handleExportTxt}
            className="glass hover:bg-foreground/5 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> TXT
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="glass hover:bg-foreground/5 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => {
              if (
                memories.length > 0 &&
                confirm(`Delete all ${memories.length} memories? This cannot be undone.`)
              ) {
                deleteAllMut.mutate();
              }
            }}
            disabled={memories.length === 0}
            className="glass text-destructive hover:bg-destructive/10 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete all
          </button>
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip active={!showArchived} onClick={() => setShowArchived(false)}>
            Active · {active.length}
          </Chip>
          <Chip active={showArchived} onClick={() => setShowArchived(true)}>
            Archived · {archived.length}
          </Chip>
          <span className="mx-1 w-px bg-foreground/10" />
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {MEMORY_CATEGORIES.map((c) => {
            const n = (showArchived ? archived : active).filter(
              (m) => m.category === c,
            ).length;
            if (n === 0) return null;
            return (
              <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {CATEGORY_LABEL[c]} · {n}
              </Chip>
            );
          })}
        </div>

        {/* Bulk bar */}
        {filtered.length > 0 && (
          <div className="glass mt-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-xs">
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected(allVisibleSelected ? [] : filtered.map((m) => m.id))
                }
                className="accent-foreground h-3.5 w-3.5"
              />
              Select all
            </label>
            <span className="text-muted-foreground">{selected.length} selected</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button
                disabled={selected.length === 0}
                onClick={() =>
                  archiveMut.mutate({ ids: selected, archived: !showArchived })
                }
                className="glass hover:bg-foreground/5 flex items-center gap-1 rounded-full px-3 py-1.5 font-medium disabled:opacity-40"
              >
                {showArchived ? (
                  <>
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </>
                )}
              </button>
              <button
                disabled={selected.length === 0}
                onClick={() => {
                  if (confirm(`Delete ${selected.length} selected memories?`))
                    deleteBulkMut.mutate(selected);
                }}
                className="glass text-destructive hover:bg-destructive/10 flex items-center gap-1 rounded-full px-3 py-1.5 font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="mt-4 space-y-2">
          {filtered.length === 0 && (
            <div className="glass text-muted-foreground rounded-3xl p-8 text-center text-sm">
              {memories.length === 0
                ? "No memories yet. Tap “Save to Memory” on any chat message, or add one manually above."
                : "No memories match your filter."}
            </div>
          )}
          {filtered.map((m) => (
            <MemoryRow
              key={m.id}
              memory={m}
              selected={selected.includes(m.id)}
              onToggleSelect={() => toggleSelect(m.id)}
              editing={editingId === m.id}
              editValue={editValue}
              editTitle={editTitle}
              editCategory={editCategory}
              onStartEdit={() => {
                setEditingId(m.id);
                setEditValue(m.content);
                setEditTitle(m.title ?? "");
                setEditCategory(m.category);
              }}
              onCancel={() => setEditingId(null)}
              onChangeEdit={setEditValue}
              onChangeTitle={setEditTitle}
              onChangeCategory={setEditCategory}
              onSave={() =>
                updateMut.mutate({
                  id: m.id,
                  content: editValue,
                  title: editTitle.trim() || null,
                  category: editCategory,
                })
              }
              onTogglePin={() =>
                pinMut.mutate({ id: m.id, pinned: !m.pinned_at })
              }
              onToggleArchive={() =>
                archiveMut.mutate({ ids: [m.id], archived: !m.archived_at })
              }
              onDelete={() => {
                if (confirm("Delete this memory?")) deleteMut.mutate(m.id);
              }}
            />
          ))}
        </div>
      </PageContainer>

    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5 text-center">
      <div className="font-display text-lg font-semibold">{value}</div>
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-medium transition",
        active
          ? "bg-foreground text-background"
          : "glass hover:bg-foreground/5 text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: MemoryCategory;
  onChange: (v: MemoryCategory) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MemoryCategory)}
      className="glass rounded-full px-3 py-1.5 text-xs font-medium outline-none"
    >
      {MEMORY_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABEL[c]}
        </option>
      ))}
    </select>
  );
}

function MemoryRow({
  memory,
  selected,
  onToggleSelect,
  editing,
  editValue,
  editTitle,
  editCategory,
  onStartEdit,
  onCancel,
  onChangeEdit,
  onChangeTitle,
  onChangeCategory,
  onSave,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: {
  memory: Memory;
  selected: boolean;
  onToggleSelect: () => void;
  editing: boolean;
  editValue: string;
  editTitle: string;
  editCategory: MemoryCategory;
  onStartEdit: () => void;
  onCancel: () => void;
  onChangeEdit: (v: string) => void;
  onChangeTitle: (v: string) => void;
  onChangeCategory: (v: MemoryCategory) => void;
  onSave: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="glass animate-fade-up group rounded-3xl p-4">
      {editing ? (
        <>
          <input
            value={editTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Title (optional)"
            className="placeholder:text-muted-foreground/60 mb-2 w-full rounded-2xl bg-foreground/5 px-3 py-2 text-[13px] font-medium outline-none"
          />
          <textarea
            value={editValue}
            onChange={(e) => onChangeEdit(e.target.value)}
            autoFocus
            rows={2}
            className="w-full resize-none rounded-2xl bg-foreground/5 p-3 text-[14px] outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <CategorySelect value={editCategory} onChange={onChangeCategory} />
            <button
              onClick={onCancel}
              className="hover:bg-foreground/5 ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={onSave}
              className="bg-primary text-primary-foreground flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="accent-foreground mt-1 h-3.5 w-3.5 shrink-0"
              aria-label="Select memory"
            />
            <div className="min-w-0">
              {memory.title && (
                <div className="text-[13px] font-semibold">{memory.title}</div>
              )}
              <div className="text-[14.5px] leading-relaxed">{memory.content}</div>
            </div>
            <div className="ml-auto flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
              <IconAction
                onClick={onTogglePin}
                label={memory.pinned_at ? "Unpin" : "Pin"}
              >
                {memory.pinned_at ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </IconAction>
              <IconAction
                onClick={onToggleArchive}
                label={memory.archived_at ? "Restore" : "Archive"}
              >
                {memory.archived_at ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </IconAction>
              <IconAction
                onClick={() =>
                  void copyText(
                    memory.title
                      ? `${memory.title}\n${memory.content}`
                      : memory.content,
                    "Memory copied",
                  )
                }
                label="Copy"
              >
                <Copy className="h-3.5 w-3.5" />
              </IconAction>
              <IconAction onClick={onStartEdit} label="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </IconAction>

              <IconAction onClick={onDelete} label="Delete" destructive>
                <Trash2 className="h-3.5 w-3.5" />
              </IconAction>
            </div>
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-[10px] tracking-wider uppercase">
            <span className="bg-foreground/5 rounded-full px-2 py-0.5 font-semibold">
              {CATEGORY_LABEL[memory.category]}
            </span>
            {memory.pinned_at && (
              <span className="bg-foreground/5 rounded-full px-2 py-0.5 font-semibold">
                Pinned
              </span>
            )}
            <span>{memory.source === "manual" ? "Saved by you" : "Auto-captured"}</span>
            <span>·</span>
            <span>{new Date(memory.created_at).toLocaleDateString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

function IconAction({
  onClick,
  label,
  destructive,
  children,
}: {
  onClick: () => void;
  label: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full transition active:scale-95",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-foreground/5",
      )}
    >
      {children}
    </button>
  );
}
