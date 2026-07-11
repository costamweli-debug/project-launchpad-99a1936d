import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
    onSuccess: () => {
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
