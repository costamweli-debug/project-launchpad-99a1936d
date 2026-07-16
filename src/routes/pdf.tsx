import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, Sparkles, Zap, Loader2, BookOpen } from "lucide-react";
import { Toaster, toast } from "sonner";
import { summarizePDF, generateQuizFromPDF } from "@/lib/ai.functions";
import { saveQuizSession } from "@/lib/quiz.functions";
import { SUBJECTS, getRank } from "@/lib/subjects";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/pdf")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "PDF Exam Papers — ExamPass AI" }],
  }),
  component: PDFPage,
});

// Lightweight PDF text extraction using pdf.js from CDN
async function extractTextFromPDF(file: File): Promise<string> {
  // @ts-ignore
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
    // @ts-ignore
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const buf = await file.arrayBuffer();
  // @ts-ignore
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: { str: string }) => item.str).join(" ") + "\n\n";
  }
  return text;
}

function PDFPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [extracting, setExtracting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("General");

  const summarizeFn = useServerFn(summarizePDF);
  const quizFn = useServerFn(generateQuizFromPDF);
  const saveFn = useServerFn(saveQuizSession);

  const { data: docsData, refetch } = useQuery({
    queryKey: ["pdfs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    setExtracting(true);
    setFilename(file.name);
    setSummary(null);
    try {
      const text = await extractTextFromPDF(file);
      setExtractedText(text);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("pdf_documents").insert({
          user_id: userData.user.id,
          filename: file.name,
          extracted_text: text.slice(0, 50000),
        });
        refetch();
      }
      trackEvent("pdf_uploaded", { filename: file.name, size: file.size });
      toast.success("PDF extracted! Now summarize or generate a quiz.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't extract text from PDF.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSummarize = async () => {
    if (!extractedText) return;
    setSummarizing(true);
    try {
      const res = await summarizeFn({ data: { text: extractedText, subject } });
      setSummary(res.summary);
    } catch (e) {
      toast.error("Couldn't summarize PDF.");
    } finally {
      setSummarizing(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!extractedText) return;
    setGenerating(true);
    try {
      const quiz = await quizFn({ data: { text: extractedText, subject, topic } });
      // Save empty session that user can immediately start
      const session = await saveFn({
        data: {
          subject,
          topic,
          questions: quiz.questions,
          answers: [],
          score: 0,
          total: quiz.questions.length,
          percentage: 0,
          rankLevel: "Beginner",
        },
      });
      // Take user directly to quiz... we need a session-id based quiz. Simplest: jump to a quiz via stored questions
      // For simplicity, navigate to results with a session that has 0 answers — or to a custom PDF quiz page.
      // Instead, store in localStorage and route to a special quiz route. For brevity:
      localStorage.setItem("pdf-quiz-questions", JSON.stringify(quiz.questions));
      localStorage.setItem("pdf-quiz-meta", JSON.stringify({ subject, topic }));
      toast.success("Quiz generated! Starting now...");
      navigate({ to: "/pdf/quiz" });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't generate quiz from PDF.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="px-4 py-8 sm:py-12">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          PDF Exam Papers
        </h1>
        <p className="mt-2" style={{ color: "var(--color-muted-foreground)" }}>
          Upload a past paper or notes. AI will summarize and generate a quiz.
        </p>

        {/* Upload */}
        <label
          className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" disabled={extracting} />
          {extracting ? (
            <>
              <Loader2 className="mb-3 h-10 w-10 animate-spin" style={{ color: "var(--color-mint)" }} />
              <p className="font-medium" style={{ color: "var(--color-foreground)" }}>Extracting text...</p>
            </>
          ) : (
            <>
              <Upload className="mb-3 h-10 w-10" style={{ color: "var(--color-mint)" }} />
              <p className="font-medium" style={{ color: "var(--color-foreground)" }}>Click to upload PDF</p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>Past exam papers, notes, or study materials</p>
            </>
          )}
        </label>

        {extractedText && (
          <div className="mt-6 rounded-2xl border p-6" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{filename}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              Extracted {extractedText.length} characters
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
                >
                  {SUBJECTS.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>Topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. General, Algebra"
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" style={{ color: "var(--color-mint)" }} />} Summarize
              </button>
              <button
                onClick={handleGenerateQuiz}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Generate Quiz
              </button>
            </div>

            {summary && (
              <div className="mt-4 rounded-xl border p-4 animate-fade-in-up" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-mint)" }}>AI Summary</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--color-foreground)" }}>{summary}</div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {docsData && docsData.length > 0 && (
          <>
            <h2 className="mt-10 mb-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
              Previously Uploaded
            </h2>
            <div className="space-y-2">
              {docsData.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}>
                  <FileText className="h-5 w-5" style={{ color: "var(--color-mint)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium" style={{ color: "var(--color-foreground)" }}>{doc.filename}</p>
                    <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
