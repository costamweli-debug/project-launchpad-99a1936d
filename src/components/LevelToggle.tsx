import { useLevel } from "@/hooks/use-level";
import type { Level } from "@/lib/curriculum.functions";

export function LevelToggle({ compact = false }: { compact?: boolean }) {
  const { level, setLevel } = useLevel();
  const levels: Level[] = ["NSSCO", "AS"];

  return (
    <div
      className="inline-flex items-center rounded-xl border p-1"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
      role="tablist"
      aria-label="Study level"
    >
      {!compact && (
        <span className="px-2 text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
          Level
        </span>
      )}
      {levels.map((l) => {
        const active = l === level;
        return (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && setLevel(l)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all"
            style={{
              backgroundColor: active ? "var(--color-mint)" : "transparent",
              color: active ? "var(--color-background)" : "var(--color-foreground)",
            }}
          >
            {l === "AS" ? "AS Level" : "NSSCO"}
          </button>
        );
      })}
    </div>
  );
}
