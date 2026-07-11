import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at, project_id, pinned")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const togglePinThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("chat_threads")
      .update({ pinned: data.pinned })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("chat_projects")
      .select("id, name, color, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1).max(80), color: z.string().max(20).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("chat_projects")
      .insert({ user_id: userId, name: data.name, color: data.color ?? "slate" })
      .select("id, name, color, created_at, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed");
    return { project: row };
  });

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("chat_projects")
      .update({ name: data.name })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // ON DELETE SET NULL will detach threads
    const { error } = await supabase
      .from("chat_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveThreadToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ threadId: z.string().uuid(), projectId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("chat_threads")
      .update({ project_id: data.projectId })
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid().nullable().optional() }).optional().parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, title: "New chat", project_id: data?.projectId ?? null })
      .select("id, title, updated_at, created_at, project_id")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to create thread");
    return { thread: row };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("chat_threads")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("chat_threads")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: thread, error: tErr } = await supabase
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread not found");

    const { data: rows, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { thread, messages: rows ?? [] };
  });

export type MessageSearchHit = {
  message_id: string;
  thread_id: string;
  thread_title: string;
  role: string;
  snippet: string;
  created_at: string;
  rank: number;
};

export const searchMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ hits: MessageSearchHit[] }> => {
    const { supabase, userId } = context;
    // Tokenize the query to a safe tsquery (prefix match per term).
    const terms = data.q
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8);
    if (terms.length === 0) return { hits: [] };
    const tsq = terms.map((t) => `${t}:*`).join(" & ");

    // Run via a single SQL using rpc would need a function; do two-step instead.
    const { data: matches, error } = await supabase
      .from("chat_messages")
      .select("id, thread_id, role, content, created_at")
      .eq("user_id", userId)
      .textSearch("content_tsv", tsq, { config: "simple" })
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    if (!matches || matches.length === 0) return { hits: [] };

    const threadIds = Array.from(new Set(matches.map((m) => m.thread_id)));
    const { data: threads } = await supabase
      .from("chat_threads")
      .select("id, title")
      .in("id", threadIds)
      .eq("user_id", userId);
    const titleById = new Map((threads ?? []).map((t) => [t.id, t.title]));

    const lowerTerms = terms;
    const makeSnippet = (content: string) => {
      const lower = content.toLowerCase();
      let idx = -1;
      for (const t of lowerTerms) {
        const i = lower.indexOf(t);
        if (i !== -1 && (idx === -1 || i < idx)) idx = i;
      }
      if (idx === -1) idx = 0;
      const start = Math.max(0, idx - 40);
      const end = Math.min(content.length, idx + 120);
      return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
    };

    const hits: MessageSearchHit[] = matches
      .filter((m) => titleById.has(m.thread_id))
      .map((m, i) => ({
        message_id: m.id,
        thread_id: m.thread_id,
        thread_title: titleById.get(m.thread_id)!,
        role: m.role,
        snippet: makeSnippet(m.content),
        created_at: m.created_at,
        rank: i,
      }));
    return { hits };
  });

// ============ TAGS ============

export const listTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tags, error } = await supabase
      .from("chat_tags")
      .select("id, name, color, created_at")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: links, error: e2 } = await supabase
      .from("chat_thread_tags")
      .select("thread_id, tag_id")
      .eq("user_id", userId);
    if (e2) throw new Error(e2.message);
    return { tags: tags ?? [], links: links ?? [] };
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1).max(40), color: z.string().max(20).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("chat_tags")
      .insert({ user_id: userId, name: data.name.trim(), color: data.color ?? "mint" })
      .select("id, name, color, created_at")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed");
    return { tag: row };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("chat_tags")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setThreadTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        tagId: z.string().uuid(),
        attach: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.attach) {
      const { error } = await supabase
        .from("chat_thread_tags")
        .upsert(
          { thread_id: data.threadId, tag_id: data.tagId, user_id: userId },
          { onConflict: "thread_id,tag_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("chat_thread_tags")
        .delete()
        .eq("thread_id", data.threadId)
        .eq("tag_id", data.tagId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
