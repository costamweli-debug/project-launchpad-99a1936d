import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// XP curve: level N requires 100 * N * N total XP.
export function xpToLevel(xp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
  const currentFloor = 100 * (level - 1) * (level - 1);
  const nextFloor = 100 * level * level;
  return {
    level,
    into: xp - currentFloor,
    span: nextFloor - currentFloor,
    xpToNext: nextFloor - xp,
  };
}

export function levelTier(level: number) {
  if (level >= 20) return { name: "Master", color: "#e11d48", emoji: "👑" };
  if (level >= 12) return { name: "Advanced", color: "#f59e0b", emoji: "🔥" };
  if (level >= 6) return { name: "Intermediate", color: "#22c55e", emoji: "🌿" };
  return { name: "Beginner", color: "#9ca3af", emoji: "🌱" };
}

type StatsRow = {
  user_id: string;
  xp: number;
  level: number;
  streak: number;
  longest_streak: number;
  last_study_date: string | null;
  daily_goal: number;
  questions_today: number;
  today_date: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

async function ensureStats(supabase: any, userId: string): Promise<StatsRow> {
  const { data } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
  if (data) {
    // roll over today counter if stale
    const today = todayISO();
    if (data.today_date !== today) {
      const { data: reset } = await supabase
        .from("user_stats")
        .update({ questions_today: 0, today_date: today })
        .eq("user_id", userId)
        .select()
        .single();
      return reset as StatsRow;
    }
    return data as StatsRow;
  }
  const { data: created } = await supabase
    .from("user_stats")
    .insert({ user_id: userId, today_date: todayISO() })
    .select()
    .single();
  return created as StatsRow;
}

export const getUserStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const row = await ensureStats(context.supabase, context.userId);
    const lv = xpToLevel(row.xp);
    return {
      stats: row,
      level: lv.level,
      xpInto: lv.into,
      xpSpan: lv.span,
      xpToNext: lv.xpToNext,
      tier: levelTier(lv.level),
    };
  });

export const setDailyGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { goal: number }) =>
    z.object({ goal: z.number().int().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureStats(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("user_stats")
      .update({ daily_goal: data.goal })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Award XP and update streak/daily counters after a quiz completes.
 * Called from saveQuizSession — not directly exposed to the client.
 */
export async function awardQuizXP(
  supabase: any,
  userId: string,
  opts: { score: number; total: number },
) {
  const row = await ensureStats(supabase, userId);
  const today = todayISO();

  // XP = 5 per quiz + 10 per correct answer
  const gained = 5 + opts.score * 10;

  // streak logic
  let streak = row.streak;
  let longest = row.longest_streak;
  if (row.last_study_date === today) {
    // same day, keep
  } else if (row.last_study_date && daysBetween(row.last_study_date, today) === 1) {
    streak = row.streak + 1;
  } else {
    streak = 1;
  }
  if (streak > longest) longest = streak;

  const questionsToday =
    row.today_date === today ? row.questions_today + opts.total : opts.total;

  const newXp = row.xp + gained;
  const newLevel = xpToLevel(newXp).level;

  await supabase
    .from("user_stats")
    .update({
      xp: newXp,
      level: newLevel,
      streak,
      longest_streak: longest,
      last_study_date: today,
      today_date: today,
      questions_today: questionsToday,
    })
    .eq("user_id", userId);

  return { xpGained: gained, newXp, newLevel, streak };
}

export interface Recommendation {
  subject: string;
  topic: string;
  reason: string;
  avgScore: number;
  attempts: number;
}

export const getRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Recent 40 sessions
    const { data: sessions } = await supabase
      .from("quiz_sessions")
      .select("subject, topic, percentage, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);

    const byKey = new Map<
      string,
      { subject: string; topic: string; total: number; sum: number }
    >();
    for (const s of sessions ?? []) {
      const key = `${s.subject}::${s.topic}`;
      const cur = byKey.get(key) ?? { subject: s.subject, topic: s.topic, total: 0, sum: 0 };
      cur.total += 1;
      cur.sum += s.percentage;
      byKey.set(key, cur);
    }

    const items = Array.from(byKey.values()).map((v) => ({
      subject: v.subject,
      topic: v.topic,
      attempts: v.total,
      avgScore: Math.round(v.sum / v.total),
    }));

    const weak = items
      .filter((i) => i.avgScore < 65)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5)
      .map<Recommendation>((i) => ({
        ...i,
        reason: i.avgScore < 40 ? "Needs urgent revision" : "Room to improve",
      }));

    const strong = items
      .filter((i) => i.avgScore >= 80)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    const lastSession = sessions?.[0]
      ? { subject: sessions[0].subject, topic: sessions[0].topic, at: sessions[0].created_at }
      : null;

    return { weak, strong, lastSession };
  });
