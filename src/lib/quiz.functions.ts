import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { awardQuizXP } from "@/lib/stats.functions";


export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  [key: string]: string | string[] | number | boolean | null | undefined;
}

export const saveQuizSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    subject: string;
    topic: string;
    questions: QuizQuestion[];
    answers: number[];
    score: number;
    total: number;
    percentage: number;
    rankLevel: string;
    level?: "NSSCO" | "AS";
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const level = data.level === "AS" ? "AS" : "NSSCO";

    const { data: session, error } = await supabase
      .from("quiz_sessions")
      .insert({
        user_id: userId,
        subject: data.subject,
        topic: data.topic,
        questions: data.questions,
        answers: data.answers,
        score: data.score,
        total: data.total,
        percentage: data.percentage,
        rank_level: data.rankLevel,
        level,
      })
      .select()
      .single();

    if (error) throw error;

    // Update progress
    const { data: existingProgress } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", userId)
      .eq("subject", data.subject)
      .single();

    if (existingProgress) {
      const newTotalQuizzes = existingProgress.total_quizzes + 1;
      const newTotalQuestions = existingProgress.total_questions + data.total;
      const newCorrectAnswers = existingProgress.correct_answers + data.score;
      const newAvgScore = Math.round(newCorrectAnswers / newTotalQuestions * 100);
      const newBestScore = Math.max(existingProgress.best_score, data.percentage);

      await supabase
        .from("progress")
        .update({
          total_quizzes: newTotalQuizzes,
          total_questions: newTotalQuestions,
          correct_answers: newCorrectAnswers,
          avg_score: newAvgScore,
          best_score: newBestScore,
          current_rank: data.rankLevel,
        })
        .eq("id", existingProgress.id);
    } else {
      await supabase.from("progress").insert({
        user_id: userId,
        subject: data.subject,
        total_quizzes: 1,
        total_questions: data.total,
        correct_answers: data.score,
        avg_score: data.percentage,
        best_score: data.percentage,
        current_rank: data.rankLevel,
      });
    }

    const xp = await awardQuizXP(supabase, userId, { score: data.score, total: data.total });
    return { session, xp };
  });


export const getQuizSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { sessions: data || [] };
  });

export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", userId)
      .order("subject", { ascending: true });

    if (error) throw error;
    return { progress: data || [] };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return { profile: data };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { display_name?: string; username?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return { profile };
  });
