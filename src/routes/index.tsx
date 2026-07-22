import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain,
  MessageSquare,
  Trophy,
  BarChart3,
  FileText,
  Zap,
  Sparkles,
  Target,
  ArrowRight,
  CheckCircle2,
  Upload,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import heroImg from "@/assets/hero.png";
import { SUBJECTS } from "@/lib/subjects";

const VALUE_STRIP = [
  { icon: Brain, label: "Real exam-style questions" },
  { icon: Zap, label: "Answers explained instantly" },
  { icon: TrendingUp, label: "See your grade improve" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "Quizzes that mirror the real exam",
    desc: "AI questions aligned to the NSSCO and AS Level syllabus. Practice exactly what you'll be tested on.",
  },
  {
    icon: MessageSquare,
    title: "A tutor that never sleeps",
    desc: "Ask anything about your subject. Get a clear answer in seconds — not next lesson.",
  },
  {
    icon: BarChart3,
    title: "Know exactly where you stand",
    desc: "See your weak topics, your strong ones, and how much you've improved this week.",
  },
  {
    icon: Trophy,
    title: "Study that feels rewarding",
    desc: "Climb from Beginner to Elite. Every quiz earns XP, so momentum builds itself.",
  },
  {
    icon: FileText,
    title: "Turn any past paper into practice",
    desc: "Upload a PDF. Get a fresh, exam-style quiz in seconds. Built for revision week.",
  },
  {
    icon: Zap,
    title: "Understand it, don't memorise it",
    desc: "Every answer comes with the reasoning. Learn the concept, not just the correct letter.",
  },
];

const STEPS = [
  { icon: Target, title: "Pick your subject", desc: "Every NSSCO and AS Level subject. One tap." },
  { icon: Sparkles, title: "Practice with AI", desc: "Quiz, ask, upload notes. Learn fast." },
  { icon: Trophy, title: "Walk in ready", desc: "Track progress. Beat the exam." },
];

const TOTAL_TOPICS = SUBJECTS.reduce((sum, s) => sum + s.topics.length, 0);

export const Route = createFileRoute("/")({
  // If already signed in, land straight on the dashboard (no landing-page flash).
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: "ExamPass AI — Pass NSSCO & AS Level with AI" },
      {
        name: "description",
        content:
          "AI-powered exam prep built for Namibian NSSCO and AS Level students. Practice with exam-style quizzes, get instant explanations, and track your progress.",
      },
      { property: "og:title", content: "ExamPass AI — Pass NSSCO & AS Level with AI" },
      {
        property: "og:description",
        content: "AI-powered exam prep built for Namibian NSSCO and AS Level students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row">
          <div className="flex-1 text-center lg:text-left">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
              style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}
            >
              <GraduationCap className="h-4 w-4" /> Built for Namibian NSSCO & AS Level students
            </div>
            <h1
              className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}
            >
              Pass your exams.
              <br />
              <span style={{ color: "var(--color-mint)" }}>Not just prepare for them.</span>
            </h1>
            <p
              className="mx-auto mt-6 max-w-lg text-lg leading-relaxed lg:mx-0"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              AI-powered practice for NSSCO and AS Level. Real questions. Instant answers. Grades that move.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold transition-all hover:scale-105"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                Start Studying Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#subjects"
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-8 py-3.5 text-base font-medium transition-colors"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                Browse Subjects
              </a>
            </div>
          </div>
          <div className="relative flex-1">
            <div
              className="absolute -inset-4 rounded-3xl opacity-30 blur-3xl"
              style={{ background: "linear-gradient(135deg, var(--color-mint), oklch(0.55 0.16 165))" }}
            />
            <img
              src={heroImg}
              alt="Namibian students studying with ExamPass AI"
              className="relative rounded-2xl"
              width={512}
              height={512}
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Value Strip */}
      <section className="border-y px-4 py-8" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          {VALUE_STRIP.map((v) => (
            <div key={v.label} className="flex items-center justify-center gap-3 text-sm font-medium sm:text-base" style={{ color: "var(--color-foreground)" }}>
              <span className="inline-flex rounded-lg p-2" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.12)" }}>
                <v.icon className="h-5 w-5" style={{ color: "var(--color-mint)" }} />
              </span>
              {v.label}
            </div>
          ))}
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="px-4 py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-mint)" }}>Subjects</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Your whole syllabus. One app.
            </h2>
            <p className="mt-4" style={{ color: "var(--color-muted-foreground)" }}>
              {SUBJECTS.length} subjects. {TOTAL_TOPICS}+ topics. Tap one to start.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SUBJECTS.map((subject) => (
              <Link
                key={subject.id}
                to="/auth"
                className="flex flex-col items-center gap-3 rounded-2xl border p-6 transition-transform hover:scale-105"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
              >
                <span className="text-4xl">{subject.emoji}</span>
                <span className="text-center text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                  {subject.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20" style={{ backgroundColor: "var(--color-surface)" }}>
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-mint)" }}>Features</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Built to move your grade.
            </h2>
            <p className="mt-4" style={{ color: "var(--color-muted-foreground)" }}>
              Every feature earns its place. No filler.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border p-6 transition-all hover:-translate-y-1"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
              >
                <div className="mb-4 inline-flex rounded-xl p-3" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.1)" }}>
                  <feature.icon className="h-6 w-6" style={{ color: "var(--color-mint)" }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--color-foreground)", fontFamily: "var(--font-display)" }}>
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-mint)" }}>How it works</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Start in under a minute.
            </h2>
            <p className="mt-4" style={{ color: "var(--color-muted-foreground)" }}>
              No setup. No signup wall. Just study.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, idx) => (
              <div
                key={step.title}
                className="relative rounded-2xl border p-8"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
              >
                <div
                  className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: "var(--color-mint)", color: "var(--color-primary-foreground)" }}
                >
                  {idx + 1}
                </div>
                <step.icon className="h-8 w-8" style={{ color: "var(--color-mint)" }} />
                <h3 className="mt-4 text-lg font-semibold" style={{ color: "var(--color-foreground)", fontFamily: "var(--font-display)" }}>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PDF highlight */}
      <section className="px-4 py-16" style={{ backgroundColor: "var(--color-surface)" }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-3xl border p-8 sm:p-12 md:grid-cols-2" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
          <div>
            <div className="inline-flex rounded-xl p-3" style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)" }}>
              <Upload className="h-6 w-6" style={{ color: "var(--color-mint)" }} />
            </div>
            <h3 className="mt-4 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Turn any past paper into a quiz.
            </h3>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
              Upload a PDF. Our AI reads it and builds an exam-style quiz in seconds.
            </p>
          </div>
          <ul className="space-y-3">
            {["AI summary of any PDF, instantly", "Fresh questions every upload", "Made for revision week"].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "var(--color-foreground)" }}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--color-mint)" }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24">
        <div
          className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl p-10 text-center sm:p-14"
          style={{ background: "linear-gradient(135deg, oklch(0.18 0.04 260), oklch(0.22 0.06 260))" }}
        >
          <div className="absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ backgroundColor: "var(--color-mint)" }} />
          <div className="relative">
            <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Your exam won't wait.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base sm:text-lg" style={{ color: "var(--color-muted-foreground)" }}>
              Every day you delay is a topic you won't master. Start tonight.
            </p>
            <Link
              to="/auth"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              Start Studying Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
