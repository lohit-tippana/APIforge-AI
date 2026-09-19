"use client";

import { use, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, BookOpen, FilePlus2, FlaskConical, Sparkles, Wand2 } from "lucide-react";
import { get, post } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/misc";
import { useWorkspace } from "@/lib/hooks";
import { toast } from "sonner";

const SUGGESTIONS = [
  { icon: FilePlus2, label: "Generate a request", prompt: "Create a POST request to register a new user with name, email and password", task: "request" },
  { icon: FlaskConical, label: "Generate tests", prompt: "Generate assertions for a JSON list response of products", task: "tests-hint" },
  { icon: BookOpen, label: "Generate docs", prompt: "", task: "docs-hint" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  generated?: unknown;
}

export default function AiPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: status } = useQuery({ queryKey: ["ai-status"], queryFn: () => get<{ provider: string; isLLM: boolean }>("/ai/status") });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const firstProject = workspace?.projects?.[0];

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      // Route by intent: request generation produces a structured result.
      const isRequestGen = /\b(create|make|generate|build|new)\b.*\b(request|endpoint|api|call)\b|\b(post|get|put|patch|delete)\s+request/i.test(text);
      if (isRequestGen) {
        const { request } = await post<{ request: { name?: string; method?: string; url?: string } }>("/ai/generate-request", { prompt: text });
        setMessages((m) => [...m, { role: "assistant", content: `Here's a generated request:\n\n\`\`\`json\n${JSON.stringify(request, null, 2)}\n\`\`\`\n\nOpen Collections → sparkle icon to generate & apply directly into the builder.`, generated: request }]);
      } else {
        setMessages((m) => [...m, {
          role: "assistant",
          content: "I can help with:\n\n- **Generate requests** — \"create a POST request to register a user with name, email, password\"\n- **Generate tests** — open a response in Collections and click *Generate tests*\n- **Explain errors** — send a failing request, then *Explain error*\n- **Generate docs** — Documentation page → generate from a collection\n- **JSON schemas & mock responses** — available from the request builder",
        }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6">
      <div className="flex items-center justify-between border-b border-border py-4">
        <div>
          <h1 className="flex items-center gap-2 text-[16px] font-semibold"><Sparkles size={16} className="text-accent" /> AI Assistant</h1>
          <p className="mt-0.5 text-[12.5px] text-fg-muted">Generate requests, tests, docs — and debug failures.</p>
        </div>
        {status && <Badge tone={status.isLLM ? "success" : "default"}>{status.isLLM ? "LLM connected" : "local engine"}</Badge>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-5">
        {messages.length === 0 && (
          <div className="mt-8">
            <p className="text-center text-[13px] text-fg-muted">What would you like to build?</p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => (s.prompt ? send(s.prompt) : firstProject ? router.push(`/w/${workspaceId}/p/${firstProject.id}/docs`) : toast.info("Create a project first"))}
                  className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-3"
                >
                  <s.icon size={15} className="text-accent" />
                  <p className="mt-2 text-[12.5px] font-medium text-fg">{s.label}</p>
                  {s.prompt && <p className="mt-1 line-clamp-2 text-[11px] text-fg-faint">{s.prompt}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`mb-4 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={
              m.role === "user"
                ? "max-w-[80%] rounded-[var(--radius-md)] bg-surface-3 px-3.5 py-2.5 text-[13px] text-fg"
                : "max-w-[85%] rounded-[var(--radius-md)] border border-border bg-surface-2 px-4 py-3 text-[13px] text-fg-muted"
            }>
              {m.content.split(/```(?:json)?\n([\s\S]*?)```/).map((part, j) =>
                j % 2 === 1 ? (
                  <pre key={j} className="my-2 overflow-x-auto rounded bg-bg p-3 font-mono text-[11.5px] text-fg-muted">{part.trim()}</pre>
                ) : (
                  part.split("\n").map((line, k) => <p key={k} className="my-0.5 leading-relaxed">{line.replace(/\*\*(.+?)\*\*/g, "$1")}</p>)
                ),
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[12.5px] text-fg-faint">
            <Wand2 size={13} className="animate-pulse text-accent" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mb-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1.5 focus-within:border-accent/40"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a request, or ask for help…"
          className="h-8 flex-1 bg-transparent px-2.5 text-[13px] text-fg placeholder:text-fg-faint focus:outline-none"
        />
        <button type="submit" disabled={busy || !input.trim()} className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-fg disabled:opacity-40">
          <ArrowUp size={14} />
        </button>
      </form>
    </div>
  );
}
