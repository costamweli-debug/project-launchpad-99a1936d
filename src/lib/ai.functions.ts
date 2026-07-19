import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI_MODEL = "gemini-3.1-flash-lite";

type Level = "NSSCO" | "AS";

function levelGuidance(level: Level) {
  if (level === "AS") {
    return {
      label: "Cambridge AS Level",
      style:
        "Use AS Level depth: precise terminology, multi-step reasoning, analysis and evaluation. Questions should test application, not recall. Expect synthesis across topics where appropriate.",
      explain:
        "Explanations should be analytical: definitions, mechanisms, and why alternatives fail. Reference relevant principles or formulae briefly.",
    };
  }
  return {
    label: "NSSCO (Grade 11–12)",
    style:
      "Use NSSCO Grade 11–12 difficulty: clear exam-style phrasing, mostly recall and direct application, occasional 'why' questions. Avoid university-level depth.",
    explain:
      "Explanations should be short, direct, and grounded in core concepts. Avoid advanced jargon. One clean reason why the answer is correct.",
  };
}

async function callAI(messages: Array<{ role: string; content: string }>, model = GEMINI_MODEL) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error("AI service not configured: missing GEMINI_API_KEY");

  // Convert OpenAI-style messages to Gemini format.
  // Gemini uses `systemInstruction` separately and `contents` with role user|model.
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(systemParts ? { systemInstruction: { parts: [{ text: systemParts }] } } : {}),
      generationConfig: { temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini API error:", response.status, text);
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.map((p) => p.text ?? "").join("").trim();
  // Gemini sometimes wraps JSON in ```json fences even when not asked to.
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string(),
});

const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).length(10),
});

const levelSchema = z.enum(["NSSCO", "AS"]).default("NSSCO");

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subject: string; topic: string; level?: Level }) =>
    z.object({ subject: z.string().min(1).max(120), topic: z.string().min(1).max(120), level: levelSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const lg = levelGuidance(data.level);
    const systemPrompt = `You are ExamPass AI — a calm, highly intelligent, strategic exam-question writer for Namibian students preparing for ${lg.label}. Tone: precise, slightly cold, never warm. No filler, no encouragement, no emojis. Generate exactly 10 multiple-choice exam questions.

${lg.style}

Strict rules:
- Each question must have exactly 4 options (A, B, C, D)
- Include the correct answer index (0–3)
- Explanation: one short, direct sentence — no padding
- Return ONLY valid JSON, no markdown, no commentary:

{
  "questions": [
    {"question":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"..."}
  ]
}`;

    const userPrompt = `Generate 10 ${lg.label} exam questions for ${data.subject} on the topic: ${data.topic}.`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    try {
      const parsed = JSON.parse(content);
      const result = quizResponseSchema.parse(parsed);
      return { questions: result.questions };
    } catch (e) {
      console.error("Failed to parse AI quiz response:", content);
      throw new Error("Failed to generate quiz. Please try again.");
    }
  });

export const explainAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { question: string; correctAnswer: string; subject: string; topic: string; level?: Level }) =>
    z
      .object({
        question: z.string().min(1).max(2000),
        correctAnswer: z.string().min(1).max(500),
        subject: z.string().min(1).max(120),
        topic: z.string().min(1).max(120),
        level: levelSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const lg = levelGuidance(data.level);
    const prompt = `${lg.label} ${data.subject} — ${data.topic}.

Question: "${data.question}"
Correct answer: "${data.correctAnswer}"

${lg.explain}

Respond in clean GitHub-flavoured markdown. Use these sections, in this order, but ONLY include the ones that genuinely apply to this question:

**Topic** — one line naming the concept.
**Key Concept** — 1–2 plain-English sentences a beginner can understand.
**Formula** — only if a formula is involved. Wrap every formula in LaTeX math delimiters: inline as $E = mc^2$, block as $$F = ma$$. Never write raw LaTeX like \\text{} or \\mu outside math delimiters.
**Symbol Meanings** — only if the formula has symbols. Bullet list, e.g. "- $m$ = mass (kg)".
**Worked Example** — 2–4 numbered steps showing the reasoning for this specific question.
**Exam Tip** — one short practical tip or common mistake.

Rules: No emojis, no praise, no filler. Skip sections that don't apply (e.g. History/English answers usually skip Formula & Symbol Meanings). Max 220 words.`;

    const explanation = await callAI([
      { role: "system", content: `You are ExamPass AI: a strict, brilliant mentor for ${lg.label} students. Sharp, precise, never warm.` },
      { role: "user", content: prompt },
    ]);

    return { explanation };
  });

export const chatWithSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: Array<{ role: string; content: string }>; subject: string; topic: string; level?: Level }) =>
    z
      .object({
        messages: z.array(z.object({ role: z.string(), content: z.string().max(8000) })).max(40),
        subject: z.string().min(1).max(120),
        topic: z.string().min(1).max(120),
        level: levelSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const lg = levelGuidance(data.level);
    const systemPrompt = `You are ExamPass AI — a Smart Tutor for ${lg.label} ${data.subject}, currently on: ${data.topic}. You act like a top student guiding a peer: clear, strategic, slightly strict, focused on real improvement.

${lg.style}

## Behavior
- Answer FIRST, then teach. No preamble.
- Break math/science problems into numbered steps.
- Adapt depth to difficulty (easy → tight; hard → full step-by-step with assumptions).
- Stay strictly within ${data.subject} → ${data.topic}. If the user drifts, reply exactly: "Focus. That question is outside your selected topic." and stop.

## Response skeleton (clean GitHub-flavoured markdown)
Include ONLY the sections that genuinely apply. Never force a section that doesn't fit.

**Topic** — one line naming what's being asked.
**Key Concept** — 1–2 plain-English sentences a beginner understands.
**Formula** — ONLY when a formula applies (Physics, Chemistry, Maths, Accounting calcs). Wrap every formula in LaTeX math delimiters: inline as $v = u + at$, block as $$E_k = \\tfrac{1}{2}mv^2$$. Never write raw LaTeX like \\text{} or \\mu outside math delimiters.
**Symbol Meanings** — ONLY when the formula has symbols. Bullet list, e.g. "- $m$ = mass (kg)".
**Worked Example** — 2–4 numbered steps for a concrete case (skip if the question is pure theory).
**Exam Tip** — one short practical tip or common mistake.

## Rules
- No emojis. No filler. No praise.
- Non-formula subjects (History, English, Geography theory, etc.) skip Formula & Symbol Meanings entirely.
- Preserve lists, tables and headings. Keep it tight.`;

    const response = await callAI([
      { role: "system", content: systemPrompt },
      ...data.messages,
    ]);

    return { response };
  });

export const summarizePDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string; subject: string; level?: Level }) =>
    z.object({ text: z.string().min(1), subject: z.string().min(1).max(120), level: levelSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const lg = levelGuidance(data.level);
    const prompt = `Summarize this ${data.subject} material into clean, exam-focused notes for a ${lg.label} student.

Output rules — follow exactly:
- Clean GitHub-flavoured markdown: short headings (##), tight bullets, tables where useful.
- Every formula MUST be wrapped in LaTeX math delimiters: inline as $v = u + at$, block as $$E_k = \\tfrac{1}{2}mv^2$$.
- Never emit raw LaTeX outside math delimiters. No \\text{}, no bare \\frac, \\times, \\mu, \\Delta, ^, or _ sitting in prose.
- Always put a space between a LaTeX command and the next identifier: write $\\Delta T$ and $F \\times d$, never $\\DeltaT$ or $F\\timesd$.
- Never double-wrap: write $\\frac{a}{b}$, never $\\frac\${a}{b}. Never leave a dangling $ or $$.
- Where a formula has symbols, add a short "Symbol meanings" bullet list (e.g. "- $m$ = mass (kg)").
- Skip formula/symbol sections entirely for non-formula subjects (History, English, Geography theory, etc.).
- No emojis, no praise, no filler.
- End with one short "Strategic focus:" line.

Material:
${data.text.slice(0, 8000)}`;

    const summary = await callAI([
      { role: "system", content: `You are ExamPass AI: a strict, brilliant ${lg.label} mentor. Calm, precise. You never emit raw or malformed LaTeX — every formula is properly delimited so it renders in KaTeX.` },
      { role: "user", content: prompt },
    ]);

    return { summary };
  });

export const generateQuizFromPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string; subject: string; topic: string; level?: Level }) =>
    z
      .object({
        text: z.string().min(1),
        subject: z.string().min(1).max(120),
        topic: z.string().min(1).max(120),
        level: levelSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const lg = levelGuidance(data.level);
    const systemPrompt = `You are ExamPass AI — calm, strategic, precise. Generate exactly 10 ${lg.label} multiple-choice questions strictly from the provided text.

${lg.style}

Strict rules:
- 4 options (A, B, C, D)
- correctAnswer is index 0–3
- Explanation: one short sentence
- Return ONLY raw JSON, no markdown:

{"questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"..."}]}`;

    const userPrompt = `Generate 10 ${lg.label} exam questions for ${data.subject} on ${data.topic} from this text:\n\n${data.text.slice(0, 8000)}`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    try {
      const parsed = JSON.parse(content);
      const result = quizResponseSchema.parse(parsed);
      return { questions: result.questions };
    } catch (e) {
      console.error("Failed to parse AI PDF quiz response:", content);
      throw new Error("Failed to generate quiz from PDF. Please try again.");
    }
  });
