import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Send, MessageSquare, Loader2, Search, Menu, Sparkles, Folder, FolderPlus, ChevronDown, ChevronRight, FolderInput, X, Tag as TagIcon, Paperclip, FileText, Image as ImageIcon, Pin, PinOff, Wand2, BookOpen, HelpCircle, Zap } from "lucide-react";
import { RichMarkdown } from "@/components/RichMarkdown";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread,
  getThreadMessages,
  listThreads,
  renameThread,
  searchMessages,
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  moveThreadToProject,
  listTags,
  createTag,
  deleteTag,
  setThreadTag,
  togglePinThread,
} from "@/lib/chat.functions";
import { createAttachment, extractImageText } from "@/lib/attachments.functions";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

type PendingAttachment = {
  tempId: string;
  id?: string; // set once saved server-side
  kind: "pdf" | "image";
  name: string;
  mime: string;
  size: number;
  status: "extracting" | "ready" | "error";
  error?: string;
};

// Lightweight PDF.js loader (same CDN pattern used elsewhere in project)
async function extractPdfText(file: File): Promise<string> {
  // @ts-ignore
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
    // @ts-ignore
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const buf = await file.arrayBuffer();
  // @ts-ignore
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 40);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: { str: string }) => it.str).join(" ") + "\n\n";
    if (text.length > 40_000) break;
  }
  return text.slice(0, 40_000);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}


export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  head: ({ params }) => ({ meta: [{ title: `Chat — ExamPass AI` }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: ChatPage,
});

type DbMessage = { id: string; role: "user" | "assistant" | "system"; content: string };

function toUIMessage(m: DbMessage): UIMessage {
  return {
    id: m.id,
    role: m.role === "system" ? "assistant" : m.role,
    parts: [{ type: "text", text: m.content }],
  } as UIMessage;
}

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listThreads);
  const getFn = useServerFn(getThreadMessages);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const renameFn = useServerFn(renameThread);
  const listProjectsFn = useServerFn(listProjects);
  const createProjectFn = useServerFn(createProject);
  const renameProjectFn = useServerFn(renameProject);
  const deleteProjectFn = useServerFn(deleteProject);
  const moveThreadFn = useServerFn(moveThreadToProject);
  const listTagsFn = useServerFn(listTags);
  const createTagFn = useServerFn(createTag);
  const deleteTagFn = useServerFn(deleteTag);
  const setThreadTagFn = useServerFn(setThreadTag);
  const togglePinFn = useServerFn(togglePinThread);

  const threadsQ = useQuery({ queryKey: ["chat-threads"], queryFn: () => listFn() });
  const projectsQ = useQuery({ queryKey: ["chat-projects"], queryFn: () => listProjectsFn() });
  const tagsQ = useQuery({ queryKey: ["chat-tags"], queryFn: () => listTagsFn() });
  const messagesQ = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: () => getFn({ data: { threadId } }),
  });

  const initialMessages = useMemo<UIMessage[]>(
    () => (messagesQ.data?.messages ?? []).map((m) => toUIMessage(m as DbMessage)),
    [messagesQ.data],
  );

  // Attachment ids queued for the next send — kept in a ref so the transport
  // fetch (which closes over stable state) always reads the freshest value.
  const pendingIdsRef = useRef<string[]>([]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          let body = init?.body;
          if (typeof body === "string") {
            try {
              const parsed = JSON.parse(body);
              parsed.threadId = threadId;
              if (pendingIdsRef.current.length > 0) {
                parsed.attachmentIds = pendingIdsRef.current;
              }
              body = JSON.stringify(parsed);
            } catch {
              // leave as-is
            }
          }
          return fetch(input, { ...init, headers, body });
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: threadId,
    transport,
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't send message. Try again.");
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    },
  });

  // Hydrate from server messages once loaded
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (messagesQ.isSuccess && hydratedFor.current !== threadId) {
      setMessages(initialMessages);
      hydratedFor.current = threadId;
    }
  }, [messagesQ.isSuccess, initialMessages, setMessages, threadId]);

  // Composer
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";
  const uploading = pending.some((p) => p.status === "extracting");

  const createAttachmentFn = useServerFn(createAttachment);
  const extractImageFn = useServerFn(extractImageText);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  // Reset pending when switching threads
  useEffect(() => {
    setPending([]);
    pendingIdsRef.current = [];
  }, [threadId]);

  const handleFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 5);
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is too large (max 15 MB).`);
        continue;
      }
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        toast.error(`${file.name}: only PDFs and images are supported.`);
        continue;
      }
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const kind: "pdf" | "image" = isPdf ? "pdf" : "image";
      setPending((prev) => [
        ...prev,
        { tempId, kind, name: file.name, mime: file.type || (isPdf ? "application/pdf" : "image/*"), size: file.size, status: "extracting" },
      ]);
      (async () => {
        try {
          let extractedText = "";
          if (isPdf) {
            extractedText = await extractPdfText(file);
          } else {
            const dataUrl = await fileToDataUrl(file);
            const res = await extractImageFn({ data: { dataUrl, name: file.name } });
            extractedText = res.text;
          }
          const { attachment } = await createAttachmentFn({
            data: {
              threadId,
              kind,
              name: file.name,
              mime: file.type || (isPdf ? "application/pdf" : "image/png"),
              size: file.size,
              extractedText,
            },
          });
          pendingIdsRef.current = [...pendingIdsRef.current, attachment.id];
          setPending((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, id: attachment.id, status: "ready" } : p)),
          );
        } catch (err) {
          console.error(err);
          const msg = err instanceof Error ? err.message : "Upload failed";
          setPending((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, status: "error", error: msg } : p)),
          );
          toast.error(`${file.name}: ${msg}`);
        }
      })();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePending = (tempId: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.tempId === tempId);
      if (target?.id) {
        pendingIdsRef.current = pendingIdsRef.current.filter((id) => id !== target.id);
      }
      return prev.filter((p) => p.tempId !== tempId);
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    const readyIds = pending.filter((p) => p.status === "ready" && p.id).map((p) => p.id as string);
    if (busy || uploading) return;
    if (!text && readyIds.length === 0) return;
    // The transport reads from pendingIdsRef; make sure it reflects only ready ids.
    pendingIdsRef.current = readyIds;
    const messageText = text || (readyIds.length > 0 ? "Please review the attached file(s)." : "");
    setInput("");
    setPending([]);
    try {
      trackEvent("ai_chat_sent", { attachments: readyIds.length });
      await sendMessage({ text: messageText });
    } finally {
      pendingIdsRef.current = [];
    }
  };


  // New chat
  const handleNew = async () => {
    try {
      const { thread } = await createFn();
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
    } catch (e) {
      toast.error("Couldn't create a new chat.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    try {
      await deleteFn({ data: { id } });
      const remaining = (threadsQ.data?.threads ?? []).filter((t) => t.id !== id);
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (id === threadId) {
        if (remaining.length > 0) {
          navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
        } else {
          const { thread } = await createFn();
          navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
        }
      }
    } catch {
      toast.error("Couldn't delete chat.");
    }
  };

  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const handleRename = async () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    if (!title) return;
    try {
      await renameFn({ data: { id: renaming.id, title } });
      setRenaming(null);
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    } catch {
      toast.error("Couldn't rename.");
    }
  };

  // Sidebar search — title filter + debounced full-text message search
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const searchFn = useServerFn(searchMessages);
  const searchQ = useQuery({
    queryKey: ["chat-search", debounced],
    queryFn: () => searchFn({ data: { q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const filteredThreads = (threadsQ.data?.threads ?? []).filter((t) =>
    !search.trim() ? true : t.title.toLowerCase().includes(search.toLowerCase()),
  );
  const showSearchResults = debounced.length >= 2;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tags
  const tags = tagsQ.data?.tags ?? [];
  const tagLinks = tagsQ.data?.links ?? [];
  const tagsByThread = useMemo(() => {
    const map = new Map<string, typeof tags>();
    for (const l of tagLinks) {
      const tag = tags.find((x) => x.id === l.tag_id);
      if (!tag) continue;
      const arr = map.get(l.thread_id) ?? [];
      arr.push(tag);
      map.set(l.thread_id, arr);
    }
    return map;
  }, [tags, tagLinks]);

  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [tagMenuFor, setTagMenuFor] = useState<string | null>(null);

  const visibleThreads = useMemo(() => {
    if (!activeTagId) return filteredThreads;
    const allowed = new Set(
      tagLinks.filter((l) => l.tag_id === activeTagId).map((l) => l.thread_id),
    );
    return filteredThreads.filter((t) => allowed.has(t.id));
  }, [filteredThreads, activeTagId, tagLinks]);

  const handleNewTag = async () => {
    const name = prompt("Tag name");
    if (!name?.trim()) return;
    try {
      await createTagFn({ data: { name: name.trim() } });
      qc.invalidateQueries({ queryKey: ["chat-tags"] });
    } catch {
      toast.error("Couldn't create tag.");
    }
  };
  const handleDeleteTag = async (id: string) => {
    if (!confirm("Delete this tag? It will be removed from all chats.")) return;
    try {
      await deleteTagFn({ data: { id } });
      if (activeTagId === id) setActiveTagId(null);
      qc.invalidateQueries({ queryKey: ["chat-tags"] });
    } catch {
      toast.error("Couldn't delete tag.");
    }
  };
  const handleToggleTagOnThread = async (threadId: string, tagId: string, attach: boolean) => {
    try {
      await setThreadTagFn({ data: { threadId, tagId, attach } });
      qc.invalidateQueries({ queryKey: ["chat-tags"] });
    } catch {
      toast.error("Couldn't update tag.");
    }
  };

  const handleTogglePin = async (id: string, currentlyPinned: boolean) => {
    try {
      await togglePinFn({ data: { id, pinned: !currentlyPinned } });
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    } catch {
      toast.error("Couldn't update pin.");
    }
  };

  const handleQuickAction = async (prompt: string) => {
    if (busy || uploading) return;
    try {
      await sendMessage({ text: prompt });
    } catch {
      toast.error("Couldn't send. Try again.");
    }
  };


  // Projects
  const projects = projectsQ.data?.projects ?? [];
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const toggleProject = (id: string) =>
    setCollapsedProjects((p) => ({ ...p, [id]: !p[id] }));
  const [movingThreadId, setMovingThreadId] = useState<string | null>(null);
  const [renamingProject, setRenamingProject] = useState<{ id: string; name: string } | null>(null);

  const pinnedThreads = useMemo(
    () => visibleThreads.filter((t) => (t as { pinned?: boolean }).pinned),
    [visibleThreads],
  );

  const threadsByProject = useMemo(() => {
    const map = new Map<string | null, typeof visibleThreads>();
    for (const t of visibleThreads) {
      if ((t as { pinned?: boolean }).pinned) continue; // shown in Pinned section
      const key = (t as { project_id: string | null }).project_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [visibleThreads]);

  const handleNewProject = async () => {
    const name = prompt("Project name");
    if (!name?.trim()) return;
    try {
      await createProjectFn({ data: { name: name.trim() } });
      qc.invalidateQueries({ queryKey: ["chat-projects"] });
    } catch {
      toast.error("Couldn't create project.");
    }
  };

  const handleRenameProject = async () => {
    if (!renamingProject) return;
    const name = renamingProject.name.trim();
    if (!name) return;
    try {
      await renameProjectFn({ data: { id: renamingProject.id, name } });
      setRenamingProject(null);
      qc.invalidateQueries({ queryKey: ["chat-projects"] });
    } catch {
      toast.error("Couldn't rename.");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Delete this project? Chats inside will move to 'Uncategorized'.")) return;
    try {
      await deleteProjectFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["chat-projects"] });
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    } catch {
      toast.error("Couldn't delete project.");
    }
  };

  const handleMoveThread = async (threadId: string, projectId: string | null) => {
    try {
      await moveThreadFn({ data: { threadId, projectId } });
      setMovingThreadId(null);
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    } catch {
      toast.error("Couldn't move chat.");
    }
  };


  const renderThreadRow = (t: { id: string; title: string; project_id?: string | null; pinned?: boolean }) => {
    const active = t.id === threadId;
    const isMoving = movingThreadId === t.id;
    const isTagging = tagMenuFor === t.id;
    const rowTags = tagsByThread.get(t.id) ?? [];
    const pinned = !!t.pinned;
    return (
      <li key={t.id}>
        {renaming?.id === t.id ? (
          <div className="flex items-center gap-1 rounded-md p-1">
            <input
              autoFocus
              value={renaming.title}
              onChange={(e) => setRenaming({ id: t.id, title: e.target.value })}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(null);
              }}
              className="flex-1 rounded border bg-transparent px-2 py-1 text-sm outline-none"
              style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            />
          </div>
        ) : (
          <div
            className="group relative rounded-md transition-colors"
            style={{ backgroundColor: active ? "var(--color-surface-raised)" : "transparent" }}
          >
            <div className="flex items-center gap-1">
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                onClick={() => setSidebarOpen(false)}
                className="flex flex-1 items-center gap-2 truncate px-2 py-1.5 text-sm transition-colors hover:opacity-90"
                style={{ color: "var(--color-foreground)" }}
              >
                {pinned ? (
                  <Pin className="h-3.5 w-3.5 flex-shrink-0 rotate-45" style={{ color: "var(--color-mint)", fill: "var(--color-mint)" }} />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" style={{ color: active ? "var(--color-mint)" : "var(--color-muted-foreground)" }} />
                )}
                <span className="truncate">{t.title}</span>
              </Link>
              <button
                onClick={() => handleTogglePin(t.id, pinned)}
                className={`h-6 w-6 items-center justify-center rounded transition-opacity md:flex ${pinned ? "flex opacity-100" : "hidden opacity-0 group-hover:opacity-100"}`}
                style={{ color: pinned ? "var(--color-mint)" : "var(--color-muted-foreground)" }}
                aria-label={pinned ? "Unpin" : "Pin"}
                title={pinned ? "Unpin chat" : "Pin chat"}
              >
                {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                onClick={() => { setTagMenuFor(isTagging ? null : t.id); setMovingThreadId(null); }}
                className="hidden h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                style={{ color: "var(--color-muted-foreground)" }}
                aria-label="Tags"
                title="Add/remove tags"
              >
                <TagIcon className="h-3 w-3" />
              </button>
              <button
                onClick={() => { setMovingThreadId(isMoving ? null : t.id); setTagMenuFor(null); }}
                className="hidden h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                style={{ color: "var(--color-muted-foreground)" }}
                aria-label="Move"
                title="Move to project"
              >
                <FolderInput className="h-3 w-3" />
              </button>
              <button
                onClick={() => setRenaming({ id: t.id, title: t.title })}
                className="hidden h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                style={{ color: "var(--color-muted-foreground)" }}
                aria-label="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="mr-1 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--color-destructive)" }}
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {rowTags.length > 0 && (
              <div className="flex flex-wrap gap-1 px-2 pb-1.5">
                {rowTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: "color-mix(in oklab, var(--color-mint) 20%, transparent)",
                      color: "var(--color-mint)",
                    }}
                    title={`Filter by ${tag.name}`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}
            {isMoving && (
              <div
                className="absolute right-2 top-full z-20 mt-1 w-44 rounded-md border p-1 shadow-lg"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
              >
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] uppercase" style={{ color: "var(--color-muted-foreground)" }}>Move to</span>
                  <button onClick={() => setMovingThreadId(null)} aria-label="Close">
                    <X className="h-3 w-3" style={{ color: "var(--color-muted-foreground)" }} />
                  </button>
                </div>
                <button
                  onClick={() => handleMoveThread(t.id, null)}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--color-foreground)" }}
                >
                  No project
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleMoveThread(t.id, p.id)}
                    className="w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {isTagging && (
              <div
                className="absolute right-2 top-full z-20 mt-1 w-52 rounded-md border p-1 shadow-lg"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
              >
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] uppercase" style={{ color: "var(--color-muted-foreground)" }}>Tags</span>
                  <button onClick={() => setTagMenuFor(null)} aria-label="Close">
                    <X className="h-3 w-3" style={{ color: "var(--color-muted-foreground)" }} />
                  </button>
                </div>
                {tags.length === 0 ? (
                  <p className="px-2 py-2 text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                    No tags yet.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {tags.map((tag) => {
                      const attached = rowTags.some((rt) => rt.id === tag.id);
                      return (
                        <label
                          key={tag.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                          style={{ color: "var(--color-foreground)" }}
                        >
                          <input
                            type="checkbox"
                            checked={attached}
                            onChange={(e) => handleToggleTagOnThread(t.id, tag.id, e.target.checked)}
                            className="h-3 w-3"
                          />
                          <span className="truncate">#{tag.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={handleNewTag}
                  className="mt-1 flex w-full items-center gap-1 rounded border-t px-2 py-1.5 text-[11px] hover:opacity-80"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-mint)" }}
                >
                  <Plus className="h-3 w-3" /> New tag
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-40 w-72" : "hidden"} md:relative md:flex md:w-72 md:flex-col border-r`}
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
      >
        <div className="flex flex-col h-full">
          <div className="p-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <button
              onClick={handleNew}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              <Plus className="h-4 w-4" /> New chat
            </button>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--color-muted-foreground)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats & messages"
                className="w-full rounded-md border bg-transparent py-1.5 pl-7 pr-2 text-xs outline-none"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {showSearchResults ? (
              searchQ.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-muted-foreground)" }} />
                </div>
              ) : (searchQ.data?.hits ?? []).length === 0 ? (
                <p className="px-2 py-4 text-xs text-center" style={{ color: "var(--color-muted-foreground)" }}>
                  No messages match "{debounced}".
                </p>
              ) : (
                <ul className="space-y-1">
                  <li className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                    {searchQ.data!.hits.length} message{searchQ.data!.hits.length === 1 ? "" : "s"}
                  </li>
                  {searchQ.data!.hits.map((h) => (
                    <li key={h.message_id}>
                      <Link
                        to="/chat/$threadId"
                        params={{ threadId: h.thread_id }}
                        onClick={() => { setSidebarOpen(false); setSearch(""); }}
                        className="flex flex-col gap-1 rounded-md px-2 py-2 text-xs transition-colors hover:opacity-90"
                        style={{ backgroundColor: h.thread_id === threadId ? "var(--color-surface-raised)" : "transparent", color: "var(--color-foreground)" }}
                      >
                        <span className="flex items-center gap-1 truncate text-[11px] font-medium">
                          <MessageSquare className="h-3 w-3 flex-shrink-0" style={{ color: "var(--color-mint)" }} />
                          <span className="truncate">{h.thread_title}</span>
                          <span className="ml-auto text-[10px] opacity-60">{h.role === "user" ? "You" : "AI"}</span>
                        </span>
                        <span className="line-clamp-2 text-[11px] opacity-80">{h.snippet}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : threadsQ.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-muted-foreground)" }} />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pinned chats */}
                {pinnedThreads.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 px-2 pt-1">
                      <Pin className="h-3 w-3 rotate-45" style={{ color: "var(--color-mint)", fill: "var(--color-mint)" }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                        Pinned
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {pinnedThreads.map((t) => renderThreadRow(t))}
                    </ul>
                  </div>
                )}
                {/* Tags filter */}
                <div>
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                      Tags
                    </span>
                    <button
                      onClick={handleNewTag}
                      className="flex h-6 w-6 items-center justify-center rounded hover:opacity-80"
                      style={{ color: "var(--color-muted-foreground)" }}
                      aria-label="New tag"
                      title="New tag"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 px-2">
                    {activeTagId && (
                      <button
                        onClick={() => setActiveTagId(null)}
                        className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                        style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
                      >
                        <X className="h-2.5 w-2.5" /> Clear
                      </button>
                    )}
                    {tags.length === 0 ? (
                      <span className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                        No tags yet.
                      </span>
                    ) : (
                      tags.map((tag) => {
                        const active = activeTagId === tag.id;
                        return (
                          <span
                            key={tag.id}
                            className="group/tag inline-flex items-center gap-0.5 rounded-full text-[10px] font-medium leading-none"
                          >
                            <button
                              onClick={() => setActiveTagId(active ? null : tag.id)}
                              className="rounded-full px-1.5 py-0.5 transition-opacity"
                              style={{
                                backgroundColor: active
                                  ? "var(--color-mint)"
                                  : "color-mix(in oklab, var(--color-mint) 18%, transparent)",
                                color: active
                                  ? "var(--color-primary-foreground)"
                                  : "var(--color-mint)",
                              }}
                            >
                              #{tag.name}
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id)}
                              className="hidden h-4 w-4 items-center justify-center rounded-full opacity-0 group-hover/tag:opacity-100 md:flex"
                              style={{ color: "var(--color-destructive)" }}
                              aria-label={`Delete tag ${tag.name}`}
                              title="Delete tag"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>


                {/* Projects header */}
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                    Projects
                  </span>
                  <button
                    onClick={handleNewProject}
                    className="flex h-6 w-6 items-center justify-center rounded hover:opacity-80"
                    style={{ color: "var(--color-muted-foreground)" }}
                    aria-label="New project"
                    title="New project"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Projects with their threads */}
                {projects.map((p) => {
                  const collapsed = collapsedProjects[p.id];
                  const items = threadsByProject.get(p.id) ?? [];
                  return (
                    <div key={p.id} className="space-y-0.5">
                      <div className="group flex items-center gap-1 rounded-md px-1">
                        <button
                          onClick={() => toggleProject(p.id)}
                          className="flex h-6 w-6 items-center justify-center"
                          style={{ color: "var(--color-muted-foreground)" }}
                          aria-label="Toggle"
                        >
                          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {renamingProject?.id === p.id ? (
                          <input
                            autoFocus
                            value={renamingProject.name}
                            onChange={(e) => setRenamingProject({ id: p.id, name: e.target.value })}
                            onBlur={handleRenameProject}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameProject();
                              if (e.key === "Escape") setRenamingProject(null);
                            }}
                            className="flex-1 rounded border bg-transparent px-1 py-0.5 text-xs outline-none"
                            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        ) : (
                          <>
                            <Folder className="h-3.5 w-3.5" style={{ color: "var(--color-mint)" }} />
                            <span
                              className="flex-1 truncate text-xs font-medium"
                              style={{ color: "var(--color-foreground)" }}
                              onDoubleClick={() => setRenamingProject({ id: p.id, name: p.name })}
                            >
                              {p.name}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                              {items.length}
                            </span>
                            <button
                              onClick={() => setRenamingProject({ id: p.id, name: p.name })}
                              className="hidden h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 md:flex"
                              style={{ color: "var(--color-muted-foreground)" }}
                              aria-label="Rename project"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteProject(p.id)}
                              className="flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100"
                              style={{ color: "var(--color-destructive)" }}
                              aria-label="Delete project"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                      {!collapsed && (
                        <ul className="ml-4 space-y-0.5 border-l pl-1" style={{ borderColor: "var(--color-border)" }}>
                          {items.length === 0 ? (
                            <li className="px-2 py-1 text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                              Empty
                            </li>
                          ) : (
                            items.map((t) => renderThreadRow(t))
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {/* Uncategorized */}
                <div className="space-y-0.5">
                  <div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                    Chats
                  </div>
                  <ul className="space-y-0.5">
                    {(threadsByProject.get(null) ?? []).length === 0 ? (
                      <li className="px-2 py-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                        No chats here.
                      </li>
                    ) : (
                      (threadsByProject.get(null) ?? []).map((t) => renderThreadRow(t))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
          <div className="border-t p-3 text-[11px]" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}>
            General AI chat. For exam practice, use{" "}
            <Link to="/dashboard" className="underline" style={{ color: "var(--color-mint)" }}>
              Study Mode
            </Link>
            .
          </div>
        </div>
      </aside>

      {/* Main */}
      <section className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-2 border-b px-4 py-2 md:hidden" style={{ borderColor: "var(--color-border)" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded p-1" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-medium">
            {threadsQ.data?.threads.find((t) => t.id === threadId)?.title ?? "Chat"}
          </span>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messagesQ.isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-mint)" }} />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState onPick={(t) => setInput(t)} />
            ) : (
              <div className="space-y-6">
                {messages.map((m, idx) => {
                  const isLast = idx === messages.length - 1;
                  const isStreaming = isLast && m.role === "assistant" && status === "streaming";
                  const showActions =
                    m.role === "assistant" &&
                    !isStreaming &&
                    status !== "submitted" &&
                    m.parts.some((p) => p.type === "text" && p.text.trim().length > 0);
                  return (
                    <div key={m.id}>
                      <MessageBubble message={m} streaming={isStreaming} />
                      {showActions && (
                        <QuickActions busy={busy || uploading} onPick={handleQuickAction} />
                      )}
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}>
          <div className="mx-auto w-full max-w-3xl p-3">
            {pending.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pending.map((p) => (
                  <div
                    key={p.tempId}
                    className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
                  >
                    {p.kind === "pdf" ? (
                      <FileText className="h-3.5 w-3.5" style={{ color: "var(--color-primary)" }} />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5" style={{ color: "var(--color-primary)" }} />
                    )}
                    <span className="max-w-[180px] truncate" style={{ color: "var(--color-foreground)" }}>
                      {p.name}
                    </span>
                    {p.status === "extracting" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {p.status === "error" && (
                      <span className="text-red-500" title={p.error}>failed</span>
                    )}
                    <button
                      onClick={() => removePending(p.tempId)}
                      className="opacity-60 hover:opacity-100"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className="flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-colors focus-within:ring-2"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-card)",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                style={{ color: "var(--color-muted-foreground)" }}
                aria-label="Attach file"
                title="Attach PDF or image (max 15 MB)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={uploading ? "Processing attachment…" : "Ask anything, or attach a PDF / image…"}
                rows={1}
                className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                style={{ color: "var(--color-foreground)" }}
                disabled={busy}
              />
              <button
                onClick={handleSend}
                disabled={busy || uploading || (!input.trim() && !pending.some((p) => p.status === "ready"))}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                aria-label="Send"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <p className="mt-2 text-center text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              ExamPass AI may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ message, streaming = false }: { message: UIMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-mint)", color: "var(--color-primary-foreground)" }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "whitespace-pre-wrap" : ""}`}
        style={
          isUser
            ? { backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }
            : { backgroundColor: "var(--color-card)", color: "var(--color-foreground)", border: "1px solid var(--color-border)" }
        }
      >
        {isUser ? (
          text || <span className="opacity-50">…</span>
        ) : text ? (
          <div className="chat-markdown">
            <RichMarkdown>{text}</RichMarkdown>
            {streaming && <span className="typing-caret" aria-hidden="true" />}
          </div>
        ) : (
          <span className="opacity-50">…</span>
        )}
      </div>
    </div>
  );
}

function QuickActions({ busy, onPick }: { busy: boolean; onPick: (prompt: string) => void }) {
  const actions: Array<{ label: string; prompt: string; icon: typeof Wand2 }> = [
    { label: "Make Quiz", icon: HelpCircle, prompt: "Turn what you just explained into a 5-question multiple-choice quiz (A–D options, then **Answer:** X with a one-line reason). Match my level." },
    { label: "Summarize", icon: BookOpen, prompt: "Summarize your previous answer in under 5 crisp bullet points I can memorize before an exam." },
    { label: "Explain Simpler", icon: Wand2, prompt: "Re-explain your previous answer in the simplest possible way, as if I'm hearing this topic for the first time. Use short sentences and one everyday analogy." },
    { label: "Harder Question", icon: Zap, prompt: "Give me a harder exam-style question on the same topic, then wait for my answer before revealing the solution." },
  ];
  return (
    <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => onPick(a.prompt)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-card)",
            color: "var(--color-foreground)",
          }}
          title={a.label}
        >
          <a.icon className="h-3 w-3" style={{ color: "var(--color-mint)" }} />
          {a.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "Explain photosynthesis simply",
    "Help me write a short essay about climate change",
    "Give me 5 tips to study smarter",
    "How does compound interest work?",
  ];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        How can I help you today?
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
        Ask anything — homework, ideas, advice, or general knowledge.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:opacity-90"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
