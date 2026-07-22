import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VISION_MODEL = "gemini-3.1-flash-lite";

type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function callGeminiVision(
  systemInstruction: string,
  userParts: Part[],
  { temperature = 0.3, model = VISION_MODEL }: { temperature?: number; model?: string } = {},
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI service not configured: missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: { temperature },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini vision failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid image data URL");
  return { mime: m[1], base64: m[2] };
}

const dataUrlSchema = z.string().min(20).max(15_000_000);

const SCAN_SYSTEM = `You are ExamPass AI's question scanner for Namibian NSSCO & AS Level students. A student has uploaded a photo, screenshot, textbook page, past-paper, or handwritten question. Analyze it and respond with STRICT JSON only — no prose before or after, no markdown fences.

Detect every distinct exam-style question in the image. For each question, produce a clean structured answer.

Formatting inside string fields:
- Use GitHub-flavoured markdown.
- Wrap every formula in LaTeX delimiters ($...$ inline, $$...$$ block). Never write raw LaTeX outside math delimiters.
- Keep language simple and beginner-friendly.
- If a section genuinely doesn't apply, use an empty string "" — never invent content.

Return this exact shape:
{
  "subject": "<detected subject or 'Unknown'>",
  "topic": "<short topic name>",
  "level": "NSSCO" | "AS" | "Unknown",
  "questions": [
    {
      "question": "<the question, transcribed clearly>",
      "explanation": "<1-3 sentence plain-English explanation of the key concept>",
      "solution": "<numbered step-by-step working in markdown; formulas in LaTeX>",
      "answer": "<final answer, concise>",
      "commonMistakes": "<1-2 short bullets in markdown, or empty string>",
      "examTip": "<one short practical tip, or empty string>"
    }
  ]
}

If the image contains no readable question, return { "subject":"Unknown","topic":"","level":"Unknown","questions":[] }.`;

const scanQuestionSchema = z.object({
  question: z.string(),
  explanation: z.string().default(""),
  solution: z.string().default(""),
  answer: z.string().default(""),
  commonMistakes: z.string().default(""),
  examTip: z.string().default(""),
});

const scanResponseSchema = z.object({
  subject: z.string().default("Unknown"),
  topic: z.string().default(""),
  level: z.string().default("Unknown"),
  questions: z.array(scanQuestionSchema).default([]),
});

export type ScannedQuestion = z.infer<typeof scanQuestionSchema>;
export type ScanResult = z.infer<typeof scanResponseSchema>;

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/** Analyze one uploaded image and detect all questions inside it. */
export const analyzeQuestionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: dataUrlSchema,
        name: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ScanResult> => {
    const { mime, base64 } = parseDataUrl(data.dataUrl);
    const raw = await callGeminiVision(SCAN_SYSTEM, [
      { text: `Analyze this uploaded ${data.name ? `image (${data.name})` : "image"} and return JSON only.` },
      { inline_data: { mime_type: mime, data: base64 } },
    ]);
    const cleaned = stripFences(raw);
    try {
      return scanResponseSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      console.error("Scanner JSON parse failed. Raw:", cleaned.slice(0, 400));
      throw new Error("Couldn't read the image clearly. Try a sharper photo or better lighting.");
    }
  });

/** Generate N similar practice questions based on a scanned question. */
export const generateSimilarQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().max(120),
        topic: z.string().max(120),
        level: z.string().max(20).default("NSSCO"),
        question: z.string().min(1).max(2000),
        count: z.number().int().min(1).max(5).default(3),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sys = `You write ${data.level === "AS" ? "Cambridge AS Level" : "NSSCO"} exam-style practice questions for Namibian students. Match the style, difficulty, and topic of the source question exactly. Return STRICT JSON only, no fences.

Shape:
{ "questions": [ { "question": "...", "answer": "...", "explanation": "..." } ] }

Rules:
- Wrap every formula in LaTeX delimiters ($...$ inline, $$...$$ block).
- "explanation" is one short sentence — beginner-friendly.
- Do NOT copy the source question verbatim; vary values, wording, and scenario.`;
    const raw = await callGeminiVision(sys, [
      {
        text: `Subject: ${data.subject}\nTopic: ${data.topic}\nSource question: "${data.question}"\n\nGenerate exactly ${data.count} similar practice questions. JSON only.`,
      },
    ], { temperature: 0.7 });
    const cleaned = stripFences(raw);
    try {
      const parsed = z
        .object({
          questions: z.array(
            z.object({
              question: z.string(),
              answer: z.string().default(""),
              explanation: z.string().default(""),
            }),
          ),
        })
        .parse(JSON.parse(cleaned));
      return { questions: parsed.questions.slice(0, data.count) };
    } catch {
      throw new Error("Couldn't generate practice questions. Try again.");
    }
  });

/**
 * Vision-based extraction for PDF pages already rendered to images on the client.
 * Runs one Gemini call per page and returns concatenated markdown that captures
 * text AND diagrams/figures/handwritten content — anything a text-only PDF extractor misses.
 */
export const extractPdfPagesVision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pages: z.array(dataUrlSchema).min(1).max(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sys = `You transcribe a page of a study PDF for a Namibian exam-prep tutor. Return plain markdown covering EVERYTHING useful on the page:
- Every readable line of text (preserve math with LaTeX $...$).
- Short 1-2 sentence descriptions of diagrams, graphs, tables, and figures — enough that a tutor could answer questions about them without seeing the page.
- Include any handwritten annotations you can read.
No preamble. Just the transcription.`;

    const chunks: string[] = [];
    for (let i = 0; i < data.pages.length; i++) {
      const { mime, base64 } = parseDataUrl(data.pages[i]);
      try {
        const text = await callGeminiVision(sys, [
          { text: `Page ${i + 1} of ${data.pages.length}. Transcribe.` },
          { inline_data: { mime_type: mime, data: base64 } },
        ], { temperature: 0.2 });
        if (text) chunks.push(`--- PAGE ${i + 1} (vision) ---\n${text}`);
      } catch (err) {
        console.error(`Vision extract failed on page ${i + 1}`, err);
      }
    }
    return { text: chunks.join("\n\n").slice(0, 40_000) };
  });
