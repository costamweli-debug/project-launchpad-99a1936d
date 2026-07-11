import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { createThread, listThreads } from "@/lib/chat.functions";

export const Route = createFileRoute("/chat/")({
  head: () => ({ meta: [{ title: "Chat — ExamPass AI" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    try {
      const { threads } = await listThreads();
      if (threads.length > 0) {
        throw redirect({ to: "/chat/$threadId", params: { threadId: threads[0].id } });
      }
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
    }
    const { thread } = await createThread();
    throw redirect({ to: "/chat/$threadId", params: { threadId: thread.id } });
  },
  component: () => null,
});
