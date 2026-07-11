import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, Trophy, Calendar, ArrowRight } from "lucide-react";
import { getProgress, getQuizSessions } from "@/lib/quiz.functions";
import { getRank, SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/progress")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Unauthorized");
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "Progress — ExamPass AI" }],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const progressFn = useServerFn(getProgress);
  const sessionsFn = useServerFn(getQuizSessions);

  const { data: progressData } = useQuery({ queryKey: ["progress"], queryFn: () => progressFn() });
  const { data: sessionsData } = useQuery({ queryKey: ["sessions"], queryFn: () => sessionsFn() });

  const progress = progressData?.progress ?? [];
  const sessions = sessionsData?.sessions ?? [];

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Your Progress
        </h1>
        <p className="mt-2" style={{ color: "var(--color-muted-foreground)" }}>
          Track your performance across all subjects.
        </p>

        <h2 className="mt-8 mb-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Per Subject
        </h2>
        {progress.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
            <BarChart3 className="mx-auto h-10 w-10" style={{ color: "var(--color-muted-foreground)" }} />
            <p className="mt-3" style={{ color: "var(--color-muted-foreground)" }}>No quizzes yet.</p>
            <Link to="/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>
              Take Your First Quiz <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {progress.map((p) => {
              const subject = SUBJECTS.find((s) => s.name === p.subject);
              const rank = getRank(p.avg_score);
              return (
                <div key={p.id} className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{subject?.emoji}</span>
                    <div>
                      <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>{p.subject}</p>
                      <p className="text-xs" style={{ color: rank.color }}>{rank.emoji} {rank.name}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Quizzes</p>
                      <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>{p.total_quizzes}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Avg</p>
                      <p className="text-lg font-bold" style={{ color: "var(--color-mint)" }}>{p.avg_score}%</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Best</p>
                      <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>{p.best_score}%</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface)" }}>
                    <div className="h-full transition-all" style={{ width: `${p.avg_score}%`, background: `linear-gradient(90deg, var(--color-mint), oklch(0.88 0.16 165))` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mt-10 mb-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Recent Quizzes
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>No quiz history yet.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 10).map((s) => {
              const rank = getRank(s.percentage);
              return (
                <Link
                  key={s.id}
                  to="/results/$sessionId"
                  params={{ sessionId: s.id }}
                  className="flex items-center justify-between rounded-xl border p-4 transition-all hover:-translate-y-0.5"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
                >
                  <div>
                    <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>{s.subject} • {s.topic}</p>
                    <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: rank.color }}>{rank.emoji} {rank.name}</span>
                    <span className="text-xl font-bold" style={{ color: "var(--color-mint)", fontFamily: "var(--font-display)" }}>{s.percentage}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
