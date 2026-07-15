import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listSubjects, listTopics } from "@/lib/curriculum.functions";
import { useServerFn } from "@tanstack/react-start";
import { useLevel } from "@/hooks/use-level";
import { LevelToggle } from "@/components/LevelToggle";

export const Route = createFileRoute("/topics/$subject")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: ({ params }) => ({
    meta: [
      { title: `Topics — ${params.subject} | ExamPass AI` },
      { name: "description", content: `Select a topic to start your AI-powered quiz.` },
    ],
  }),
  component: TopicsPage,
});

function TopicsPage() {
  const { subject: subjectId } = Route.useParams();
  const navigate = useNavigate();
  const { level } = useLevel();

  const fetchSubjects = useServerFn(listSubjects);
  const fetchTopics = useServerFn(listTopics);

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchSubjects(),
  });
  const { data: topicsData, isLoading: topicsLoading } = useQuery({
    queryKey: ["topics", subjectId, level],
    queryFn: () => fetchTopics({ data: { subjectId, level } }),
  });

  const subject = subjectsData?.subjects.find((s) => s.id === subjectId);
  const topics = topicsData?.topics ?? [];

  if (subjectsData && !subject) {
    return (
      <div className="px-4 py-12 text-center">
        <p>Subject not found.</p>
        <Link to="/dashboard" className="mt-4 inline-block underline" style={{ color: "var(--color-mint)" }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80" style={{ color: "var(--color-muted-foreground)" }}>
          <ArrowLeft className="h-4 w-4" /> Back to subjects
        </Link>

        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: `${subject?.color ?? "#60a5fa"}20` }}>
              {subject?.emoji ?? "📘"}
            </div>
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
                {subject?.name ?? subjectId}
              </h1>
              <p className="mt-1" style={{ color: "var(--color-muted-foreground)" }}>{subject?.description}</p>
            </div>
          </div>
          <LevelToggle />
        </div>

        <h2 className="mb-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Choose a Topic <span className="text-sm font-normal" style={{ color: "var(--color-muted-foreground)" }}>({level === "AS" ? "AS Level" : "NSSCO"})</span>
        </h2>

        {topicsLoading ? (
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>Loading topics…</p>
        ) : topics.length === 0 ? (
          <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
            <p style={{ color: "var(--color-muted-foreground)" }}>
              No {level === "AS" ? "AS Level" : "NSSCO"} topics yet for {subject?.name ?? subjectId}.
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Try switching the level above.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="group flex items-center justify-between rounded-xl border p-4 transition-all hover:-translate-y-0.5"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
              >
                <span className="font-medium" style={{ color: "var(--color-foreground)" }}>{topic.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate({ to: "/chat/$subject/$topic", params: { subject: subjectId, topic: topic.slug } })}
                    className="rounded-lg p-2 transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--color-surface-raised)" }}
                    title="Chat with AI"
                  >
                    <MessageSquare className="h-4 w-4" style={{ color: "var(--color-mint)" }} />
                  </button>
                  <button
                    onClick={() => navigate({ to: "/quiz/$subject/$topic", params: { subject: subjectId, topic: topic.slug } })}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:scale-105"
                    style={{ backgroundColor: subject?.color ?? "#60a5fa", color: "var(--color-background)" }}
                  >
                    <Zap className="h-4 w-4" /> Quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
