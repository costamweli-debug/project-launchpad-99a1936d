import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Zap, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRank } from "@/lib/subjects";
import { saveQuizSession, type QuizQuestion } from "@/lib/quiz.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/pdf/quiz")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Unauthorized");
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "PDF Quiz — ExamPass AI" }],
  }),
  component: PDFQuizPage,
});

function PDFQuizPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [meta, setMeta] = useState<{ subject: string; topic: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const saveFn = useServerFn(saveQuizSession);

  useEffect(() => {
    const q = localStorage.getItem("pdf-quiz-questions");
    const m = localStorage.getItem("pdf-quiz-meta");
    if (q && m) {
      setQuestions(JSON.parse(q));
      setMeta(JSON.parse(m));
    }
  }, []);

  if (questions.length === 0 || !meta) {
    return (
      <div className="px-4 py-12 text-center">
        <p style={{ color: "var(--color-muted-foreground)" }}>No quiz loaded.</p>
        <Link to="/pdf" className="mt-4 inline-block underline" style={{ color: "var(--color-mint)" }}>
          Upload a PDF
        </Link>
      </div>
    );
  }

  const handleNext = async () => {
    if (selectedAnswer === null) return;
    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const score = newAnswers.reduce((sum, ans, i) => sum + (ans === questions[i].correctAnswer ? 1 : 0), 0);
      const percentage = Math.round((score / questions.length) * 100);
      const rank = getRank(percentage);
      try {
        const result = await saveFn({
          data: {
            subject: meta.subject,
            topic: meta.topic + " (PDF)",
            questions,
            answers: newAnswers,
            score,
            total: questions.length,
            percentage,
            rankLevel: rank.name,
          },
        });
        localStorage.removeItem("pdf-quiz-questions");
        localStorage.removeItem("pdf-quiz-meta");
        navigate({ to: "/results/$sessionId", params: { sessionId: result.session.id } });
      } catch (e) {
        toast.error("Couldn't save results");
      }
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="px-4 py-8">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/pdf" className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80" style={{ color: "var(--color-muted-foreground)" }}>
            <ArrowLeft className="h-4 w-4" /> Quit
          </Link>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}>
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        <div className="mb-6 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--color-mint), oklch(0.88 0.16 165))" }} />
        </div>

        <div key={currentIndex} className="rounded-2xl border p-6 sm:p-8 animate-fade-in-up" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
            <BookOpen className="h-3 w-3" /> {meta.subject} • {meta.topic}
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
                    style={{ backgroundColor: isSelected ? "var(--color-mint)" : "var(--color-surface)", color: isSelected ? "var(--color-background)" : "var(--color-foreground)" }}
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
            {currentIndex + 1 === questions.length ? <>Finish <Zap className="h-4 w-4" /></> : <>Next <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
