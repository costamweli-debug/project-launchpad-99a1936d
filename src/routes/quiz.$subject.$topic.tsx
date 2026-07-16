import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Zap, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRank } from "@/lib/subjects";
import { generateQuiz } from "@/lib/ai.functions";
import { saveQuizSession, type QuizQuestion } from "@/lib/quiz.functions";
import { listSubjects, listTopics } from "@/lib/curriculum.functions";
import { useServerFn } from "@tanstack/react-start";
import { useLevel } from "@/hooks/use-level";
import { toast, Toaster } from "sonner";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/quiz/$subject/$topic")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: ({ params }) => ({
    meta: [
      { title: `Quiz — ${params.subject} | ExamPass AI` },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { subject: subjectId, topic: topicSlug } = Route.useParams();
  const navigate = useNavigate();
  const { level } = useLevel();

  const fetchSubjects = useServerFn(listSubjects);
  const fetchTopics = useServerFn(listTopics);
  const { data: subjectsData } = useQuery({ queryKey: ["subjects"], queryFn: () => fetchSubjects() });
  const { data: topicsData } = useQuery({
    queryKey: ["topics", subjectId, level],
    queryFn: () => fetchTopics({ data: { subjectId, level } }),
  });

  const subject = subjectsData?.subjects.find((s) => s.id === subjectId);
  const topic = topicsData?.topics.find((t) => t.slug === topicSlug);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const generateFn = useServerFn(generateQuiz);
  const saveFn = useServerFn(saveQuizSession);

  useEffect(() => {
    if (!subject || !topic) return;
    setLoading(true);
    trackEvent("start_quiz", { subject: subject.name, topic: topic.name, level });
    generateFn({ data: { subject: subject.name, topic: topic.name, level } })
      .then((res) => setQuestions(res.questions))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to generate quiz. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [subjectId, topicSlug, level]);


  if (!subject || !topic) {
    return <div className="px-4 py-12 text-center">Invalid subject or topic.</div>;
  }

  const handleNext = async () => {
    if (selectedAnswer === null) return;
    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Finished
      const score = newAnswers.reduce((sum, ans, i) => sum + (ans === questions[i].correctAnswer ? 1 : 0), 0);
      const percentage = Math.round((score / questions.length) * 100);
      const rank = getRank(percentage);
      try {
        const result = await saveFn({
          data: {
            subject: subject.name,
            topic: topic.name,
            questions,
            answers: newAnswers,
            score,
            total: questions.length,
            percentage,
            rankLevel: rank.name,
            level,
          },
        });
        trackEvent("finish_quiz", {
          subject: subject.name,
          topic: topic.name,
          score,
          total: questions.length,
          percentage,
          level,
        });
        navigate({ to: "/results/$sessionId", params: { sessionId: result.session.id } });
      } catch (e) {
        console.error(e);
        toast.error("Failed to save results");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center gap-4 px-4">
        <Toaster position="top-center" richColors />
        <div className="flex h-20 w-20 items-center justify-center rounded-full animate-pulse-glow" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)" }}>
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: "var(--color-mint)" }} />
        </div>
        <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Generating your quiz...
        </h2>
        <p className="max-w-md text-center" style={{ color: "var(--color-muted-foreground)" }}>
          AI is creating 10 {level === "AS" ? "AS Level" : "NSSCO"} questions for {subject.name} • {topic.name}.
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center gap-4 px-4">
        <p>Couldn't generate quiz. Please try again.</p>
        <Link to="/topics/$subject" params={{ subject: subjectId }} className="underline" style={{ color: "var(--color-mint)" }}>
          Back to topics
        </Link>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="px-4 py-8">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/topics/$subject" params={{ subject: subjectId }} className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80" style={{ color: "var(--color-muted-foreground)" }}>
            <ArrowLeft className="h-4 w-4" /> Quit Quiz
          </Link>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}>
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-6 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--color-mint), oklch(0.88 0.16 165))" }}
          />
        </div>

        {/* Question */}
        <div key={currentIndex} className="rounded-2xl border p-6 sm:p-8 animate-fade-in-up" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
            <BookOpen className="h-3 w-3" /> {subject.name} • {topic.name}
          </div>
          <h2 className="mt-2 text-lg font-semibold leading-relaxed sm:text-xl" style={{ color: "var(--color-foreground)", fontFamily: "var(--font-display)" }}>
            {currentQuestion.question}
          </h2>

          <div className="mt-6 space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedAnswer === idx;
              const letter = String.fromCharCode(65 + idx);
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedAnswer(idx)}
                  className="flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.01]"
                  style={{
                    borderColor: isSelected ? "var(--color-mint)" : "var(--color-border)",
                    backgroundColor: isSelected ? "oklch(0.72 0.18 165 / 0.1)" : "var(--color-background)",
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                    style={{
                      backgroundColor: isSelected ? "var(--color-mint)" : "var(--color-surface)",
                      color: isSelected ? "var(--color-background)" : "var(--color-foreground)",
                    }}
                  >
                    {letter}
                  </span>
                  <span className="text-sm sm:text-base" style={{ color: "var(--color-foreground)" }}>{option}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={selectedAnswer === null}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {currentIndex + 1 === questions.length ? <>Finish Quiz <Zap className="h-4 w-4" /></> : <>Next Question <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
