import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const MEMORY_CATEGORIES = [
  "preference",
  "project",
  "goal",
  "style",
  "fact",
  "general",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type Memory = {
  id: string;
  title: string | null;
  content: string;
  category: MemoryCategory;
  source: "auto" | "manual";
  thread_id: string | null;
  pinned_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, title, content, category, source, thread_id, pinned_at, archived_at, created_at, updated_at";

const categorySchema = z.enum(MEMORY_CATEGORIES);

export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memories")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return (data ?? []) as unknown as Memory[];
  });

export const createMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        content: z.string().min(2).max(1000),
        title: z.string().max(120).optional(),
        category: categorySchema.optional(),
        source: z.enum(["auto", "manual"]).optional(),
        thread_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const content = data.content.trim();

    // Prevent duplicates — same user, same content.
    const { data: dupe } = await context.supabase
      .from("memories")
      .select(SELECT)
      .eq("user_id", context.userId)
      .eq("content", content)
      .maybeSingle();
    if (dupe) return dupe as unknown as Memory;

    const { data: row, error } = await context.supabase
      .from("memories")
      .insert({
        user_id: context.userId,
        content,
        title: data.title?.trim() || null,
        category: data.category ?? "fact",
        source: data.source ?? "manual",
        thread_id: data.thread_id ?? null,
      })
      .select(SELECT)
      .single();
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return row as unknown as Memory;
  });

export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        content: z.string().min(2).max(1000).optional(),
        title: z.string().max(120).nullable().optional(),
        category: categorySchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.content !== undefined) patch.content = data.content.trim();
    if (data.title !== undefined) patch.title = data.title?.trim() || null;
    if (data.category !== undefined) patch.category = data.category;
    const { error } = await context.supabase
      .from("memories")
      .update(patch)
      .eq("id", data.id);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { ok: true };
  });

export const setMemoryPinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .update({ pinned_at: data.pinned ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { ok: true };
  });

export const setMemoriesArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ ids: z.array(z.string().uuid()).min(1), archived: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .in("id", data.ids);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .eq("id", data.id);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { ok: true };
  });

export const deleteMemoriesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .in("id", data.ids);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { ok: true };
  });

export const deleteAllMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .eq("user_id", context.userId);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { ok: true };
  });

export const importMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memories: z
          .array(
            z.object({
              content: z.string().min(2).max(1000),
              title: z.string().max(120).nullish(),
              category: categorySchema.optional(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("memories")
      .select("content")
      .eq("user_id", context.userId);
    const seen = new Set(
      ((existing ?? []) as { content: string }[]).map((m) => m.content),
    );
    const rows = data.memories
      .map((m) => ({ ...m, content: m.content.trim() }))
      .filter((m) => {
        if (seen.has(m.content)) return false;
        seen.add(m.content);
        return true;
      })
      .map((m) => ({
        user_id: context.userId,
        content: m.content,
        title: m.title?.trim() || null,
        category: m.category ?? "general",
        source: "manual" as const,
      }));
    if (rows.length === 0) return { inserted: 0 };
    const { error } = await context.supabase.from("memories").insert(rows);
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return { inserted: rows.length };
  });

export const exportMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memories")
      .select("title, content, category, source, pinned_at, archived_at, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      throw new Error("Something went wrong, please try again.");
    }
    return {
      exported_at: new Date().toISOString(),
      count: data?.length ?? 0,
      memories: data ?? [],
    };
  });
