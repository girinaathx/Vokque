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
  content: string;
  category: MemoryCategory;
  source: "auto" | "manual";
  thread_id: string | null;
  created_at: string;
  updated_at: string;
};

const categorySchema = z.enum(MEMORY_CATEGORIES);

export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memories")
      .select("id, content, category, source, thread_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return (data ?? []) as Memory[];
  });

export const createMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        content: z.string().min(2).max(1000),
        category: categorySchema.optional(),
        source: z.enum(["auto", "manual"]).optional(),
        thread_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("memories")
      .insert({
        user_id: context.userId,
        content: data.content.trim(),
        category: data.category ?? "fact",
        source: data.source ?? "manual",
        thread_id: data.thread_id ?? null,
      })
      .select("id, content, category, source, thread_id, created_at, updated_at")
      .single();
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return row as Memory;
  });

export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        content: z.string().min(2).max(1000),
        category: categorySchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .update({
        content: data.content.trim(),
        ...(data.category ? { category: data.category } : {}),
      })
      .eq("id", data.id);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
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
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });

export const deleteAllMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .eq("user_id", context.userId);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });

export const exportMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memories")
      .select("content, category, source, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return {
      exported_at: new Date().toISOString(),
      count: data?.length ?? 0,
      memories: data ?? [],
    };
  });
