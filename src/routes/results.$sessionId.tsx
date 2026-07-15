import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Trophy, ArrowRight, MessageSquare, Sparkles, Loader2, Home } from "lucide-react";
import { getRank } from "@/lib/subjects";
import { explainAnswer } from "@/lib/ai.functions";
import type { QuizQuestion } from "@/lib/quiz.functions";

export const Route = createFileRoute("/results/$sessionId")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "Quiz Results — ExamPass AI" }],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { sessionId } = Route.useParams();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--color-mint)" }} />
      </div>
    );
  }

  if (!session) {
    return <div className="px-4 py-12 text-center">Session not found.</div>;
  }

  const questions = session.questions as unknown as QuizQuestion[];
  const answers = session.answers as unknown as number[];
  const rank = getRank(session.percentage);

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        {/* Score Card */}
        <div className="rounded-3xl border p-8 text-center animate-fade-in-up" style={{ borderColor: "var(--color-border)", background: "linear-gradient(135deg, oklch(0.18 0.04 260), oklch(0.22 0.06 260))" }}>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full animate-pulse-glow" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.2)" }}>
            <Trophy className="h-10 w-10" style={{ color: rank.color }} />
          </div>
          <p className="mt-4 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
            {session.subject} • {session.topic}
          </p>
          <h1 className="mt-1 text-6xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
            {session.percentage}%
          </h1>
          <p className="mt-2 text-lg" style={{ color: "var(--color-foreground)" }}>
            {session.score} / {session.total} correct
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: `${rank.color}20`, color: rank.color }}>
            <span>{rank.emoji}</span> {rank.name}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              <Home className="h-4 w-4" /> Dashboard
            </Link>
            <Link
              to="/progress"
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors"
              style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              View Progress <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Question Review */}
        <h2 className="mt-10 mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Review Your Answers
        </h2>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionReview
              key={i}
              question={q}
              userAnswer={answers[i]}
              index={i}
              subject={session.subject}
              topic={session.topic}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionReview({
  question,
  userAnswer,
  index,
  subject,
  topic,
}: {
  question: QuizQuestion;
  userAnswer: number;
  index: number;
  subject: string;
  topic: string;
}) {
  const isCorrect = userAnswer === question.correctAnswer;
  const [showExplanation, setShowExplanation] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const explainFn = useServerFn(explainAnswer);

  const handleExplain = async () => {
    if (aiExplanation) {
      setShowExplanation(!showExplanation);
      return;
    }
    setLoading(true);
    setShowExplanation(true);
    try {
      const res = await explainFn({
        data: {
          question: question.question,
          correctAnswer: question.options[question.correctAnswer],
          subject,
          topic,
        },
      });
      setAiExplanation(res.explanation);
    } catch (e) {
      console.error(e);
      setAiExplanation("Couldn't load explanation. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: isCorrect ? "oklch(0.6 0.2 145 / 0.2)" : "oklch(0.55 0.22 25 / 0.2)" }}
        >
          {isCorrect ? <Check className="h-4 w-4" style={{ color: "oklch(0.7 0.2 145)" }} /> : <X className="h-4 w-4" style={{ color: "oklch(0.65 0.22 25)" }} />}
        </span>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
            Question {index + 1}
          </p>
          <p className="mt-1 font-medium" style={{ color: "var(--color-foreground)" }}>{question.question}</p>

          <div className="mt-3 space-y-2">
            {question.options.map((opt, idx) => {
              const isUserChoice = idx === userAnswer;
              const isCorrectChoice = idx === question.correctAnswer;
              const letter = String.fromCharCode(65 + idx);
              const color = isCorrectChoice ? "oklch(0.7 0.2 145)" : isUserChoice ? "oklch(0.65 0.22 25)" : "var(--color-muted-foreground)";
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: isCorrectChoice || isUserChoice ? color : "var(--color-border)",
                    backgroundColor: isCorrectChoice ? "oklch(0.6 0.2 145 / 0.08)" : isUserChoice && !isCorrectChoice ? "oklch(0.55 0.22 25 / 0.08)" : "transparent",
                  }}
                >
                  <span className="font-bold" style={{ color }}>{letter}</span>
                  <span style={{ color: "var(--color-foreground)" }}>{opt}</span>
                  {isCorrectChoice && <Check className="ml-auto h-4 w-4" style={{ color: "oklch(0.7 0.2 145)" }} />}
                  {isUserChoice && !isCorrectChoice && <X className="ml-auto h-4 w-4" style={{ color: "oklch(0.65 0.22 25)" }} />}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleExplain}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}
          >
            <Sparkles className="h-3.5 w-3.5" /> {showExplanation ? "Hide" : "Explain"} Answer
          </button>

          {showExplanation && (
            <div className="mt-3 rounded-xl border p-4 text-sm leading-relaxed animate-fade-in-up" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}>
              {loading ? (
                <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Thinking...</div>
              ) : (
                <>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-mint)" }}>AI Explanation</p>
                  <p>{aiExplanation || question.explanation}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
