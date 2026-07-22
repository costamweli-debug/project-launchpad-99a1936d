import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster, toast } from "sonner";
import { Camera, Upload, Loader2, Sparkles, Wand2, X, ScanLine, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RichMarkdown } from "@/components/RichMarkdown";
import { analyzeQuestionImage, generateSimilarQuestions, type ScanResult } from "@/lib/scan.functions";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/scan")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI Question Scanner — ExamPass AI" },
      { name: "description", content: "Upload a photo of any exam question and get an instant, step-by-step explanation." },
      { property: "og:title", content: "AI Question Scanner — ExamPass AI" },
      { property: "og:description", content: "Snap a question. Get the answer, working, and practice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: ScanPage,
});

const MAX_BYTES = 8 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type PracticeSet = { questions: { question: string; answer: string; explanation: string }[] };

function ScanPage() {
  const analyzeFn = useServerFn(analyzeQuestionImage);
  const practiceFn = useServerFn(generateSimilarQuestions);

  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [practiceByIdx, setPracticeByIdx] = useState<Record<number, PracticeSet | "loading">>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const activeQuestion = result?.questions[activeIdx] ?? null;
  const practice = practiceByIdx[activeIdx];

  const reset = () => {
    setPreview(null);
    setFilename("");
    setResult(null);
    setActiveIdx(0);
    setPracticeByIdx({});
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image (JPG, PNG, HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large (max 8 MB). Try a lower-resolution photo.");
      return;
    }
    setResult(null);
    setPracticeByIdx({});
    setActiveIdx(0);
    setFilename(file.name);
    setScanning(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const res = await analyzeFn({ data: { dataUrl, name: file.name } });
      if (!res.questions || res.questions.length === 0) {
        toast.error("No readable question detected. Try a clearer photo.");
      } else {
        trackEvent("question_scanned", { count: res.questions.length, subject: res.subject });
        toast.success(res.questions.length === 1 ? "Question detected." : `Detected ${res.questions.length} questions.`);
      }
      setResult(res);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const generatePractice = async () => {
    if (!result || !activeQuestion) return;
    setPracticeByIdx((prev) => ({ ...prev, [activeIdx]: "loading" }));
    try {
      const res = await practiceFn({
        data: {
          subject: result.subject,
          topic: result.topic,
          level: result.level === "AS" ? "AS" : "NSSCO",
          question: activeQuestion.question,
          count: 3,
        },
      });
      setPracticeByIdx((prev) => ({ ...prev, [activeIdx]: res }));
    } catch (err) {
      setPracticeByIdx((prev) => {
        const next = { ...prev };
        delete next[activeIdx];
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Couldn't generate practice.");
    }
  };

  return (
    <div className="px-4 py-8 sm:py-12">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: "oklch(0.72 0.18 165 / 0.15)", color: "var(--color-mint)" }}
            >
              <ScanLine className="h-3.5 w-3.5" /> AI Question Scanner
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Snap a question. Get the answer.
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
              Photos, screenshots, textbook pages, past papers, handwritten notes — upload it and get a step-by-step solution.
            </p>
          </div>
        </div>

        {/* Upload / Preview */}
        {!preview ? (
          <>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--color-border)" }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
                disabled={scanning}
              />
              <Upload className="mb-3 h-10 w-10" style={{ color: "var(--color-mint)" }} />
              <p className="font-medium" style={{ color: "var(--color-foreground)" }}>Tap to upload or take a photo</p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>JPG, PNG, HEIC · up to 8 MB</p>
              <span
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: "var(--color-surface)", color: "var(--color-foreground)" }}
              >
                <Camera className="h-3.5 w-3.5" /> Camera works on mobile
              </span>
            </label>
          </>
        ) : (
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
            <div className="flex items-start gap-4">
              <img src={preview} alt={filename || "Uploaded question"} className="h-32 w-32 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{filename || "Scanned image"}</p>
                {scanning ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm" style={{ color: "var(--color-mint)" }}>
                    <Loader2 className="h-4 w-4 animate-spin" /> Reading your question…
                  </p>
                ) : result && result.questions.length > 0 ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {result.subject && result.subject !== "Unknown" ? result.subject : "Detected question"}
                    {result.topic ? ` · ${result.topic}` : ""}
                    {result.questions.length > 1 ? ` · ${result.questions.length} questions` : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>No text detected</p>
                )}
                <button
                  onClick={reset}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                >
                  <X className="h-3.5 w-3.5" /> Scan another
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-question picker */}
        {result && result.questions.length > 1 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
              Choose a question
            </p>
            <div className="flex flex-wrap gap-2">
              {result.questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  style={{
                    borderColor: i === activeIdx ? "var(--color-mint)" : "var(--color-border)",
                    backgroundColor: i === activeIdx ? "oklch(0.72 0.18 165 / 0.15)" : "var(--color-card)",
                    color: "var(--color-foreground)",
                  }}
                >
                  Q{i + 1}
                  <span className="ml-1 max-w-[10rem] truncate align-middle text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {q.question.length > 40 ? ` — ${q.question.slice(0, 40)}…` : ` — ${q.question}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active question detail */}
        {activeQuestion && (
          <div
            className="mt-6 rounded-2xl border p-6 animate-fade-in-up"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
          >
            <Section title="Question">
              <RichMarkdown className="chat-markdown text-sm leading-relaxed">{activeQuestion.question}</RichMarkdown>
            </Section>
            {activeQuestion.explanation && (
              <Section title="Key Concept">
                <RichMarkdown className="chat-markdown text-sm leading-relaxed">{activeQuestion.explanation}</RichMarkdown>
              </Section>
            )}
            {activeQuestion.solution && (
              <Section title="Step-by-Step Solution">
                <RichMarkdown className="chat-markdown text-sm leading-relaxed">{activeQuestion.solution}</RichMarkdown>
              </Section>
            )}
            {activeQuestion.answer && (
              <Section title="Final Answer" accent>
                <RichMarkdown className="chat-markdown text-sm leading-relaxed">{activeQuestion.answer}</RichMarkdown>
              </Section>
            )}
            {activeQuestion.commonMistakes && (
              <Section title="Common Mistakes">
                <RichMarkdown className="chat-markdown text-sm leading-relaxed">{activeQuestion.commonMistakes}</RichMarkdown>
              </Section>
            )}
            {activeQuestion.examTip && (
              <Section title="Exam Tip">
                <RichMarkdown className="chat-markdown text-sm leading-relaxed">{activeQuestion.examTip}</RichMarkdown>
              </Section>
            )}

            {/* Practice */}
            <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--color-border)" }}>
              {practice === "loading" ? (
                <p className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--color-mint)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating practice questions…
                </p>
              ) : practice ? (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-mint)" }}>
                    Practice Questions
                  </p>
                  <ol className="space-y-3">
                    {practice.questions.map((p, i) => (
                      <li
                        key={i}
                        className="rounded-xl border p-4"
                        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}
                      >
                        <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                          {i + 1}. {p.question}
                        </p>
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer" style={{ color: "var(--color-mint)" }}>Show answer</summary>
                          <div className="mt-2" style={{ color: "var(--color-foreground)" }}>
                            <p><strong>Answer:</strong> {p.answer}</p>
                            {p.explanation && (
                              <p className="mt-1" style={{ color: "var(--color-muted-foreground)" }}>{p.explanation}</p>
                            )}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <button
                  onClick={generatePractice}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:scale-105"
                  style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                >
                  <Wand2 className="h-4 w-4" /> Generate 3 similar practice questions <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty tip */}
        {!preview && !scanning && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)", color: "var(--color-muted-foreground)" }}>
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-mint)" }} />
            <p>Tip: for handwritten questions, keep the paper flat and well-lit. Crop the image to the question if you can.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, accent = false }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="mt-4 first:mt-0">
      <p
        className="mb-1.5 text-xs font-semibold uppercase tracking-wider"
        style={{ color: accent ? "var(--color-mint)" : "var(--color-muted-foreground)" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}
