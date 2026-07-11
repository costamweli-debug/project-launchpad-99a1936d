import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Target, Sparkles, TrendingUp, TrendingDown, ArrowRight, Play } from "lucide-react";
import { getUserStats, setDailyGoal, getRecommendations, levelTier } from "@/lib/stats.functions";
import { useState } from "react";

export function StudyHub() {
  const fetchStats = useServerFn(getUserStats);
  const fetchRecs = useServerFn(getRecommendations);
  const updateGoal = useServerFn(setDailyGoal);
  const qc = useQueryClient();

  const { data: statsData } = useQuery({ queryKey: ["user-stats"], queryFn: () => fetchStats() });
  const { data: recsData } = useQuery({ queryKey: ["recs"], queryFn: () => fetchRecs() });

  const goalMut = useMutation({
    mutationFn: (goal: number) => updateGoal({ data: { goal } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-stats"] }),
  });

  const [editing, setEditing] = useState(false);

  if (!statsData) return null;
  const s = statsData.stats;
  const tier = statsData.tier ?? levelTier(statsData.level);
  const progressPct = Math.min(100, Math.round((s.questions_today / Math.max(1, s.daily_goal)) * 100));
  const xpPct = Math.min(100, Math.round((statsData.xpInto / Math.max(1, statsData.xpSpan)) * 100));

  const weak = recsData?.weak ?? [];
  const strong = recsData?.strong ?? [];
  const last = recsData?.lastSession ?? null;

  return (
    <section className="mb-10 grid gap-4 md:grid-cols-3">
      {/* Level & XP */}
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>Level {statsData.level}</p>
            <p className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: tier.color }}>
              {tier.emoji} {tier.name}
            </p>
          </div>
          <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}>
            {s.xp} XP
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="h-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, var(--color-mint), ${tier.color})` }} />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          {statsData.xpToNext} XP to Level {statsData.level + 1}
        </p>
      </div>

      {/* Streak */}
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>Streak</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              <Flame className="h-6 w-6" style={{ color: "#f97316" }} />
              {s.streak} {s.streak === 1 ? "day" : "days"}
            </p>
          </div>
          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Best {s.longest_streak}</span>
        </div>
        {last ? (
          <Link
            to="/quiz/$subject/$topic"
            params={{ subject: last.subject, topic: last.topic }}
            className="mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition-all hover:-translate-y-0.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span style={{ color: "var(--color-muted-foreground)" }}>
              Continue: <strong style={{ color: "var(--color-foreground)" }}>{last.topic}</strong>
            </span>
            <Play className="h-3.5 w-3.5" style={{ color: "var(--color-mint)" }} />
          </Link>
        ) : (
          <p className="mt-3 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Take a quiz today to start a streak.</p>
        )}
      </div>

      {/* Daily Goal */}
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>Daily Goal</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              <Target className="h-5 w-5" style={{ color: "var(--color-mint)" }} />
              {s.questions_today} / {s.daily_goal} questions
            </p>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs underline"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="h-full transition-all" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--color-mint), oklch(0.88 0.16 165))" }} />
        </div>
        {editing && (
          <div className="mt-3 flex gap-2">
            {[5, 10, 20, 40].map((g) => (
              <button
                key={g}
                disabled={goalMut.isPending}
                onClick={() => { goalMut.mutate(g); setEditing(false); }}
                className="flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: g === s.daily_goal ? "var(--color-mint)" : "var(--color-border)",
                  color: g === s.daily_goal ? "var(--color-mint)" : "var(--color-foreground)",
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations spans full width */}
      {(weak.length > 0 || strong.length > 0) && (
        <div className="md:col-span-3 grid gap-4 md:grid-cols-2">
          {weak.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" style={{ color: "#f43f5e" }} />
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
                  Needs improvement
                </h3>
              </div>
              <ul className="space-y-2">
                {weak.map((w) => (
                  <li key={`${w.subject}-${w.topic}`}>
                    <Link
                      to="/quiz/$subject/$topic"
                      params={{ subject: w.subject, topic: w.topic }}
                      className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all hover:-translate-y-0.5"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <div>
                        <p className="font-medium" style={{ color: "var(--color-foreground)" }}>{w.topic}</p>
                        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{w.subject} · {w.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: "#f43f5e" }}>{w.avgScore}%</span>
                        <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--color-muted-foreground)" }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {strong.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: "var(--color-mint)" }} />
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
                  Strong subjects
                </h3>
              </div>
              <ul className="space-y-2">
                {strong.map((w) => (
                  <li
                    key={`${w.subject}-${w.topic}`}
                    className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <div>
                      <p className="font-medium" style={{ color: "var(--color-foreground)" }}>{w.topic}</p>
                      <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{w.subject}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-mint)" }}>
                      <Sparkles className="h-3 w-3" /> {w.avgScore}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
