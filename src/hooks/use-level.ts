import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyLevel, setMyLevel, type Level } from "@/lib/curriculum.functions";

export function useLevel() {
  const fetchLevel = useServerFn(getMyLevel);
  const updateLevel = useServerFn(setMyLevel);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-level"],
    queryFn: () => fetchLevel(),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (level: Level) => updateLevel({ data: { level } }),
    // Optimistic update so the toggle responds instantly on slow devices/networks.
    onMutate: async (level: Level) => {
      await qc.cancelQueries({ queryKey: ["my-level"] });
      const previous = qc.getQueryData<{ level: Level }>(["my-level"]);
      qc.setQueryData(["my-level"], { level });
      return { previous };
    },
    onError: (err, _level, ctx) => {
      if (ctx?.previous) qc.setQueryData(["my-level"], ctx.previous);
      console.error("[useLevel] setMyLevel failed", err);
      toast.error("Couldn't switch level. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-level"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
    },
  });

  return {
    level: (data?.level ?? "NSSCO") as Level,
    isLoading,
    setLevel: (l: Level) => mutation.mutate(l),
    isSaving: mutation.isPending,
  };
}
