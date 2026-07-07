import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<Record<string, string>>;
};


export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, updated_at, created_at, pinned_at")
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return data ?? [];
  });

export const pinThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.pinned) {
      // enforce max 5 pins per user
      const { count } = await context.supabase
        .from("threads")
        .select("id", { count: "exact", head: true })
        .not("pinned_at", "is", null);
      if ((count ?? 0) >= 5) {
        throw new Error("You can pin up to 5 chats.");
      }
    }
    const { error } = await context.supabase
      .from("threads")
      .update({ pinned_at: data.pinned ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });

export const deleteAllThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("threads")
      .delete()
      .eq("user_id", context.userId);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });

export const deleteThreadsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .delete()
      .in("id", data.ids);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });


export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ title: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("threads")
      .insert({
        user_id: context.userId,
        title: data.title ?? "New conversation",
      })
      .select("id, title, updated_at, created_at")
      .single();
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .delete()
      .eq("id", data.id);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    const messages: StoredMessage[] = (rows ?? []).map((r) => ({
      id: r.id,
      role: r.role as StoredMessage["role"],
      parts: Array.isArray(r.parts)
        ? (r.parts as StoredMessage["parts"])
        : [],
    }));
    return messages;
  });

export const truncateThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: z.string().uuid(), keep: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); throw new Error("Something went wrong, please try again."); }
    const toDelete = (rows ?? []).slice(data.keep).map((r) => r.id);
    if (toDelete.length > 0) {
      const { error: delErr } = await context.supabase
        .from("messages")
        .delete()
        .in("id", toDelete);
      if (delErr) throw new Error(delErr.message);
    }
    return { ok: true, deleted: toDelete.length };
  });
