import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_STORED_TEXT = 40_000;

/**
 * OCR / describe an image using the Lovable AI Gateway (Gemini vision).
 * Accepts a data URL (data:image/...;base64,...).
 */
export const extractImageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(20).max(15_000_000),
        name: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You transcribe images for a study assistant. Return: (1) every readable line of text verbatim (preserve math, symbols, and layout as best you can); (2) a short 1-2 sentence description of any diagrams, charts, or figures. Output plain text only. No preamble.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Transcribe and briefly describe this image${data.name ? ` (${data.name})` : ""}.` },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OCR failed: ${res.status} ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text: text.slice(0, MAX_STORED_TEXT) };
  });

export const createAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        kind: z.enum(["pdf", "image"]),
        name: z.string().min(1).max(300),
        mime: z.string().min(1).max(100),
        size: z.number().int().nonnegative().max(30 * 1024 * 1024),
        extractedText: z.string().max(MAX_STORED_TEXT).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Verify thread ownership
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    const { data: row, error } = await supabase
      .from("chat_attachments")
      .insert({
        user_id: userId,
        thread_id: data.threadId,
        kind: data.kind,
        name: data.name,
        mime: data.mime,
        size: data.size,
        extracted_text: data.extractedText ?? "",
      })
      .select("id, kind, name, mime, size, created_at")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to save attachment");
    return { attachment: row };
  });

export const listThreadAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("chat_attachments")
      .select("id, kind, name, mime, size, created_at")
      .eq("thread_id", data.threadId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { attachments: rows ?? [] };
  });
