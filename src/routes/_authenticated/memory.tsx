import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  createMemory,
  deleteAllMemories,
  deleteMemory,
  exportMemories,
  listMemories,
  updateMemory,
  MEMORY_CATEGORIES,
  type Memory,
  type MemoryCategory,
} from "@/lib/memories.functions";
import { Brain, Download, Plus, Search, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "Memory · Avenxa" },
      {
        name: "description",
        content:
          "Review, edit, export, and delete everything Avenxa remembers about you.",
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

function MemoryPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemories);
  const createFn = useServerFn(createMemory);
  const updateFn = useServerFn(updateMemory);
  const deleteFn = useServerFn(deleteMemory);
  const deleteAllFn = useServerFn(deleteAllMemories);
  const exportFn = useServerFn(exportMemories);

  const { data: memories = [] } = useQuery({
    queryKey: ["memories"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("fact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryCategory>("fact");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter(
      (m) =>
        (filter === "all" || m.category === filter) &&
        (!q || m.content.toLowerCase().includes(q)),
    );
  }, [memories, query, filter]);

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: { content: newContent.trim(), category: newCategory, source: "manual" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      setNewContent("");
      toast.success("Memory saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; content: string; category: MemoryCategory }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      setEditingId(null);
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Memory deleted");
    },
  });

  const deleteAllMut = useMutation({
    mutationFn: () => deleteAllFn({ data: undefined as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("All memories deleted");
    },
  });

  const handleExport = async () => {
    const data = await exportFn({ data: undefined as never });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `open-intelligence-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-32 lg:pt-12">
        <div className="animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="glass flex h-11 w-11 items-center justify-center rounded-2xl">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Memory
              </h1>
              <p className="text-muted-foreground text-sm">
                Everything Avenxa remembers about you. Yours to edit,
                export, or delete — anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Add manually */}
        <div className="animate-fade-up glass-strong mt-6 rounded-3xl p-4 [animation-delay:80ms]">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
            Add a memory
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            placeholder="e.g. I prefer vegetarian food when traveling."
            className="placeholder:text-muted-foreground/70 w-full resize-none rounded-2xl bg-black/3 p-3 text-[14px] outline-none"
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
          <div className="glass flex flex-1 items-center gap-2 rounded-full px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories…"
              className="placeholder:text-muted-foreground/70 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <button
            onClick={handleExport}
            className="glass hover:bg-black/5 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
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
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All · {memories.length}
          </Chip>
          {MEMORY_CATEGORIES.map((c) => {
            const n = memories.filter((m) => m.category === c).length;
            if (n === 0) return null;
            return (
              <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {CATEGORY_LABEL[c]} · {n}
              </Chip>
            );
          })}
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          {filtered.length === 0 && (
            <div className="glass text-muted-foreground rounded-3xl p-8 text-center text-sm">
              {memories.length === 0
                ? "No memories yet. Chat with Avenxa — it will start remembering. You can also add memories manually above."
                : "No memories match your filter."}
            </div>
          )}
          {filtered.map((m) => (
            <MemoryRow
              key={m.id}
              memory={m}
              editing={editingId === m.id}
              editValue={editValue}
              editCategory={editCategory}
              onStartEdit={() => {
                setEditingId(m.id);
                setEditValue(m.content);
                setEditCategory(m.category);
              }}
              onCancel={() => setEditingId(null)}
              onChangeEdit={setEditValue}
              onChangeCategory={setEditCategory}
              onSave={() =>
                updateMut.mutate({
                  id: m.id,
                  content: editValue,
                  category: editCategory,
                })
              }
              onDelete={() => {
                if (confirm("Delete this memory?")) deleteMut.mutate(m.id);
              }}
            />
          ))}
        </div>
      </div>
    </AppShell>
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
          : "glass hover:bg-black/5 text-muted-foreground",
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
  editing,
  editValue,
  editCategory,
  onStartEdit,
  onCancel,
  onChangeEdit,
  onChangeCategory,
  onSave,
  onDelete,
}: {
  memory: Memory;
  editing: boolean;
  editValue: string;
  editCategory: MemoryCategory;
  onStartEdit: () => void;
  onCancel: () => void;
  onChangeEdit: (v: string) => void;
  onChangeCategory: (v: MemoryCategory) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="glass animate-fade-up group rounded-3xl p-4">
      {editing ? (
        <>
          <textarea
            value={editValue}
            onChange={(e) => onChangeEdit(e.target.value)}
            autoFocus
            rows={2}
            className="w-full resize-none rounded-2xl bg-black/3 p-3 text-[14px] outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <CategorySelect value={editCategory} onChange={onChangeCategory} />
            <button
              onClick={onCancel}
              className="hover:bg-black/5 ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
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
            <div className="text-[14.5px] leading-relaxed">{memory.content}</div>
            <div className="ml-auto flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                onClick={onStartEdit}
                className="hover:bg-black/5 flex h-7 w-7 items-center justify-center rounded-full"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="hover:bg-destructive/10 text-destructive flex h-7 w-7 items-center justify-center rounded-full"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider">
            <span className="bg-black/5 rounded-full px-2 py-0.5 font-semibold">
              {CATEGORY_LABEL[memory.category]}
            </span>
            <span>{memory.source === "manual" ? "Saved by you" : "Auto-captured"}</span>
            <span>·</span>
            <span>{new Date(memory.created_at).toLocaleDateString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
