import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Star, Crown, Zap } from "lucide-react";
import { RANKS, getRank } from "@/lib/subjects";
import { getProgress } from "@/lib/quiz.functions";

export const Route = createFileRoute("/rank")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Unauthorized");
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "Your Rank — ExamPass AI" }],
  }),
  component: RankPage,
});

function RankPage() {
  const progressFn = useServerFn(getProgress);
  const { data } = useQuery({ queryKey: ["progress"], queryFn: () => progressFn() });

  const allScores = data?.progress.map((p) => p.avg_score) ?? [];
  const overallAvg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const currentRank = getRank(overallAvg);

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-center text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          Your Rank
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center" style={{ color: "var(--color-muted-foreground)" }}>
          Your rank is calculated from your average quiz performance across all subjects.
        </p>

        <div className="mt-8 rounded-3xl border p-8 text-center" style={{ borderColor: "var(--color-border)", background: "linear-gradient(135deg, oklch(0.18 0.04 260), oklch(0.22 0.06 260))" }}>
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-5xl animate-pulse-glow" style={{ backgroundColor: `${currentRank.color}30` }}>
            {currentRank.emoji}
          </div>
          <h2 className="mt-4 text-4xl font-bold" style={{ fontFamily: "var(--font-display)", color: currentRank.color }}>
            {currentRank.name}
          </h2>
          <p className="mt-2 text-lg" style={{ color: "var(--color-foreground)" }}>
            {overallAvg}% Overall Average
          </p>
        </div>

        <h3 className="mt-10 mb-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
          All Ranks
        </h3>
        <div className="space-y-3">
          {RANKS.map((rank) => {
            const isCurrent = rank.name === currentRank.name;
            return (
              <div
                key={rank.name}
                className="flex items-center gap-4 rounded-2xl border p-4 transition-all"
                style={{
                  borderColor: isCurrent ? rank.color : "var(--color-border)",
                  backgroundColor: isCurrent ? `${rank.color}10` : "var(--color-card)",
                }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl" style={{ backgroundColor: `${rank.color}20` }}>
                  {rank.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: rank.color }}>{rank.name}</p>
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{rank.minScore}% and above</p>
                </div>
                {isCurrent && (
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: rank.color, color: "var(--color-background)" }}>
                    YOU
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
