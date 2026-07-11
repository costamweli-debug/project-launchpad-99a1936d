import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Zap, Trophy } from "lucide-react";
import { getRank } from "@/lib/subjects";
import { getProgress } from "@/lib/quiz.functions";
import { listSubjects, type CurriculumSubject } from "@/lib/curriculum.functions";
import { useServerFn } from "@tanstack/react-start";
import { LevelToggle } from "@/components/LevelToggle";
import { useLevel } from "@/hooks/use-level";
import { StudyHub } from "@/components/StudyHub";


export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ExamPass AI" },
      { name: "description", content: "Choose a subject and start studying with AI-generated quizzes." },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Unauthorized");
    return { user: data.user };
  },
  component: DashboardPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  CORE: "Core Subjects",
  COMMERCIAL: "Commercial Subjects",
  HUMANITIES: "Humanities",
  LANGUAGES: "Languages",
  TECHNICAL: "Technical Subjects",
  OTHER: "Other",
};
const CATEGORY_ORDER = ["CORE", "COMMERCIAL", "HUMANITIES", "LANGUAGES", "TECHNICAL", "OTHER"];

function DashboardPage() {
  const fetchProgress = useServerFn(getProgress);
  const fetchSubjects = useServerFn(listSubjects);
  const { level } = useLevel();

  const { data: progressData } = useQuery({
    queryKey: ["progress"],
    queryFn: () => fetchProgress(),
  });
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchSubjects(),
  });

  const subjects = subjectsData?.subjects ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, CurriculumSubject[]>();
    for (const s of subjects) {
      const key = CATEGORY_ORDER.includes(s.category) ? s.category : "OTHER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [subjects]);

  const progressMap = new Map(progressData?.progress.map((p) => [p.subject, p]) ?? []);
  const totalQuizzes = progressData?.progress.reduce((sum, p) => sum + p.total_quizzes, 0) ?? 0;
  const avgScore = progressData?.progress.length
    ? Math.round(progressData.progress.reduce((sum, p) => sum + p.avg_score, 0) / progressData.progress.length)
    : 0;

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Choose a Subject
            </h1>
            <p className="mt-2" style={{ color: "var(--color-muted-foreground)" }}>
              Studying at <strong style={{ color: "var(--color-mint)" }}>{level === "AS" ? "AS Level" : "NSSCO"}</strong>. Switch anytime.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LevelToggle />
            <div className="rounded-xl border px-4 py-2" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
              <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Quizzes</p>
              <p className="text-xl font-bold" style={{ color: "var(--color-mint)", fontFamily: "var(--font-display)" }}>{totalQuizzes}</p>
            </div>
            <div className="rounded-xl border px-4 py-2" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
              <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Avg Score</p>
              <p className="text-xl font-bold" style={{ color: "var(--color-mint)", fontFamily: "var(--font-display)" }}>{avgScore}%</p>
            </div>
          </div>
        </div>
        <StudyHub />


        {grouped.map(({ category, items }) => (
          <section key={category} className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((subject) => {
                const prog = progressMap.get(subject.name);
                const rank = prog ? getRank(prog.avg_score) : null;
                return (
                  <Link
                    key={subject.id}
                    to="/topics/$subject"
                    params={{ subject: subject.id }}
                    className="group relative flex flex-col rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
                    style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-4xl">{subject.emoji}</span>
                      <div className="rounded-lg p-2 transition-colors" style={{ backgroundColor: `${subject.color}20` }}>
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" style={{ color: subject.color }} />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
                      {subject.name}
                    </h3>
                    <p className="mt-1 text-sm line-clamp-2" style={{ color: "var(--color-muted-foreground)" }}>
                      {subject.description}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      {prog ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${rank?.color}20`, color: rank?.color }}>
                            <Trophy className="h-3 w-3" /> {rank?.name}
                          </span>
                          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{prog.total_quizzes} quizzes</span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}>
                          <Zap className="h-3 w-3" /> Start Learning
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: subject.color }} />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {subjects.length === 0 && (
          <p className="text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>Loading subjects…</p>
        )}
      </div>
    </div>
  );
}
