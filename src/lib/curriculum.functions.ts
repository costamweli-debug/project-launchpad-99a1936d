import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Level = "NSSCO" | "AS";

export interface CurriculumSubject {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  category: string;
  sort_order: number;
}

export interface CurriculumTopic {
  id: string;
  subject_id: string;
  level: Level;
  slug: string;
  name: string;
  sort_order: number;
}

const levelSchema = z.enum(["NSSCO", "AS"]);

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("curriculum_subjects")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return { subjects: (data ?? []) as CurriculumSubject[] };
  });

export const listTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subjectId: string; level: Level }) =>
    z.object({ subjectId: z.string().min(1).max(64), level: levelSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("curriculum_topics")
      .select("*")
      .eq("subject_id", data.subjectId)
      .eq("level", data.level)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return { topics: (rows ?? []) as CurriculumTopic[] };
  });

export const getMyLevel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("level")
      .eq("user_id", context.userId)
      .maybeSingle();
    const level = (data?.level as Level | undefined) ?? "NSSCO";
    return { level };
  });

export const setMyLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { level: Level }) => z.object({ level: levelSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ level: data.level })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { level: data.level };
  });
