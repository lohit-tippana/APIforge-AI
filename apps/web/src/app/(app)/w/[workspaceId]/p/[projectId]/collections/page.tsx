"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, FilePlus2, Save, Send, Sparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiRequest, Assertion, ExecutedResponse } from "@/lib/types";
import { useProject } from "@/lib/hooks";
import { useWorkspaceStore } from "@/lib/store";
import { useProjectSocket } from "@/lib/socket";
import { CollectionTree } from "@/components/api-client/collection-tree";
import { MethodSelect } from "@/components/api-client/method-select";
import { KvEditor } from "@/components/api-client/kv-editor";
import { BodyEditor } from "@/components/api-client/body-editor";
import { AuthEditor } from "@/components/api-client/auth-editor";
import { AssertionsEditor } from "@/components/api-client/assertions-editor";
import { ResponseViewer } from "@/components/api-client/response-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ScrollArea } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Zap } from "lucide-react";
import { toast } from "sonner";

function MarkdownLite({ text }: { text: string }) {
  // Minimal markdown renderer for AI output (headings, bold, code, lists, tables).
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _l, code) => `<pre><code>${code.trimEnd()}</code></pre>`)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g, (_m, head: string, body: string) => {
      const ths = head.split("|").map((c) => `<th>${c.trim()}</th>`).join("");
      const rows = body.trim().split("\n").map((r) => `<tr>${r.split("|").slice(1, -1).map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`).join("");
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<)(.+)$/gm, (m) => (m.trim().startsWith("<") ? m : m));
  return <div className="doc-content text-[13px]" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

export default function CollectionsPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: project, isLoading } = useProject(projectId);
  useProjectSocket(projectId);

  const store = useWorkspaceStore();
  const { draft, response, sending, sendError } = store;
  const [tab, setTab] = useState("params");
  const [aiDialog, setAiDialog] = useState<null | "generate" | "explain" | "tests" | "docs">(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTests, setAiTests] = useState<Assertion[] | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const pendingOpen = useRef<string | null>(null);

  // URL-driven deep links: ?request=<id>, ?new=request|collection
  useEffect(() => {
    const rid = searchParams.get("request");
    if (rid && rid !== pendingOpen.current) {
      pendingOpen.current = rid;
      openRequestById(rid);
    }
    if (searchParams.get("new") === "request") {
      store.newRequest(project?.collections?.[0]?.id ?? null);
      router.replace(window.location.pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, project]);

  const activeEnvId = store.activeEnvironmentId
    ?? project?.environments?.find((e) => e.isDefault)?.id
    ?? project?.environments?.[0]?.id
    ?? null;

  async function openRequestById(id: string) {
    try {
      const { request } = await get<{ request: ApiRequest }>(`/requests/${id}`);
      store.loadRequest({
        requestId: request.id,
        collectionId: request.collectionId,
        name: request.name,
        method: request.method,
        url: request.url,
        params: request.params,
        headers: request.headers,
        bodyType: request.bodyType,
        body: request.body ?? "",
        authType: request.authType,
        authConfig: request.authConfig ?? {},
        assertions: request.assertions,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const send = async () => {
    if (!draft.url.trim()) return;
    store.setSending(true);
    store.setSendError(null);
    try {
      const { response: r } = await post<{ response: ExecutedResponse }>("/execute", {
        projectId,
        requestId: draft.requestId,
        environmentId: activeEnvId,
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        params: draft.params,
        bodyType: draft.bodyType,
        body: draft.body || null,
        authType: draft.authType,
        authConfig: draft.authConfig,
      });
      store.setResponse(r);
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["analytics", projectId] });
    } catch (e) {
      store.setResponse(null);
      store.setSendError((e as Error).message);
    } finally {
      store.setSending(false);
    }
  };

  // Ctrl+Enter sends
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        send();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, activeEnvId]);

  const save = async (as?: { collectionId: string; folderId?: string | null; name: string }) => {
    const payload = {
      name: as?.name ?? draft.name,
      method: draft.method,
      url: draft.url,
      bodyType: draft.bodyType,
      body: draft.body || null,
      authType: draft.authType,
      authConfig: draft.authConfig,
      headers: draft.headers.filter((h) => h.key || h.value),
      params: draft.params.filter((p) => p.key || p.value),
      assertions: draft.assertions,
      folderId: as?.folderId ?? (draft.requestId ? undefined : null),
      collectionId: as?.collectionId ?? draft.collectionId ?? undefined,
    };
    try {
      if (draft.requestId) {
        await put(`/requests/${draft.requestId}`, payload);
        store.patchDraft({ dirty: false });
        qc.invalidateQueries({ queryKey: ["project"] });
        toast.success("Request saved");
      } else if (as) {
        const { request } = await post<{ request: ApiRequest }>("/requests", payload);
        store.loadRequest({ ...payload, requestId: request.id, collectionId: request.collectionId } as never);
        qc.invalidateQueries({ queryKey: ["project"] });
        toast.success("Request saved");
      } else {
        setSaveAsOpen(true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runCollection = async (collectionId: string) => {
    try {
      const { testRun } = await post<{ testRun: { id: string } }>("/test-runs", {
        collectionId,
        environmentId: activeEnvId,
      });
      toast.success("Collection run finished");
      router.push(`/w/${project?.workspaceId}/p/${projectId}/test-runs/${testRun.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ── AI actions ──
  const aiGenerateRequest = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    setAiOutput("");
    try {
      const { request } = await post<{ request: { name?: string; method?: string; url?: string; headers?: { key: string; value: string }[]; params?: { key: string; value: string }[]; bodyType?: string; body?: string } }>(
        "/ai/generate-request",
        { prompt: aiPrompt },
      );
      setAiOutput(JSON.stringify(request, null, 2));
      // Stash for apply
      (window as never as Record<string, unknown>).__aiGeneratedRequest = request;
    } catch (e) {
      setAiOutput(`Error: ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const applyGenerated = () => {
    const r = (window as never as Record<string, unknown>).__aiGeneratedRequest as { name?: string; method?: string; url?: string; headers?: { key: string; value: string }[]; params?: { key: string; value: string }[]; bodyType?: string; body?: string } | undefined;
    if (!r) return;
    store.patchDraft({
      name: r.name ?? draft.name,
      method: r.method ?? "GET",
      url: r.url ?? "",
      headers: [...(r.headers ?? []).map((h) => ({ ...h, enabled: true })), { key: "", value: "", enabled: true }],
      params: [...(r.params ?? []).map((p) => ({ ...p, enabled: true })), { key: "", value: "", enabled: true }],
      bodyType: r.bodyType ?? "NONE",
      body: r.body ?? "",
    });
    setAiDialog(null);
    toast.success("Generated request applied — review before sending");
  };

  const aiExplain = async () => {
    setAiDialog("explain");
    setAiBusy(true);
    setAiOutput("");
    try {
      const { explanation } = await post<{ explanation: string }>("/ai/explain-error", {
        request: { method: draft.method, url: draft.url, authType: draft.authType, headers: draft.headers, body: draft.body },
        response: response ?? null,
        error: sendError ?? undefined,
      });
      setAiOutput(explanation);
    } catch (e) {
      setAiOutput(`Error: ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const aiTestsGenerate = async () => {
    if (!response) return;
    setAiDialog("tests");
    setAiBusy(true);
    setAiTests(null);
    try {
      const data = await post<{ assertions: Assertion[] }>("/ai/generate-tests", { response });
      setAiTests(data.assertions);
    } catch (e) {
      toast.error((e as Error).message);
      setAiDialog(null);
    } finally {
      setAiBusy(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-fg-faint border-t-accent" /></div>;
  }

  return (
    <div className="flex h-full">
      <CollectionTree
        collections={project?.collections ?? []}
        projectId={projectId}
        onSelectRequest={(r) => openRequestById(r.id)}
        onRunCollection={(c) => runCollection(c.id)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Request header row ── */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center">
            <MethodSelect value={draft.method} onChange={(m) => store.patchDraft({ method: m })} />
            <input
              value={draft.url}
              onChange={(e) => store.patchDraft({ url: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="https://api.example.com/endpoint or {{BASE_URL}}/…"
              spellCheck={false}
              className="h-8 min-w-0 flex-1 rounded-r-[var(--radius-sm)] border border-border bg-surface-2 px-3 font-mono text-[12.5px] text-fg placeholder:text-fg-faint focus:border-accent/50 focus:outline-none"
            />
          </div>
          <Button variant="primary" onClick={send} disabled={sending || !draft.url.trim()} className="px-4">
            {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-fg/30 border-t-accent-fg" /> : <Send size={13} />}
            Send
          </Button>
          <Button onClick={() => (draft.requestId ? save() : setSaveAsOpen(true))} title="Save (Ctrl+S)">
            <Save size={13} /> Save
          </Button>
          <Button variant="ghost" onClick={() => setAiDialog("generate")} title="Generate request with AI">
            <Sparkles size={13} className="text-accent" />
          </Button>
        </div>

        {/* ── Request name bar ── */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <Zap size={13} className="text-fg-faint" />
          <input
            value={draft.name}
            onChange={(e) => store.patchDraft({ name: e.target.value })}
            className="h-6 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-fg focus:outline-none"
            placeholder="Request name"
          />
          {draft.dirty && <Badge tone="warning">unsaved</Badge>}
        </div>

        {/* ── Config tabs ── */}
        <div className="min-h-0 flex-1 basis-[46%] overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
            <TabsList className="shrink-0 px-2">
              <TabsTrigger value="params">Params</TabsTrigger>
              <TabsTrigger value="auth">Authorization</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="tests">
                Tests {draft.assertions.length > 0 && <span className="ml-1 rounded-full bg-surface-3 px-1.5 text-[10px]">{draft.assertions.length}</span>}
              </TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-auto">
              <TabsContent value="params" className="m-0"><KvEditor rows={draft.params} onChange={(params) => store.patchDraft({ params })} keyPlaceholder="Parameter" /></TabsContent>
              <TabsContent value="auth" className="m-0"><AuthEditor authType={draft.authType} authConfig={draft.authConfig} onChange={(authType, authConfig) => store.patchDraft({ authType, authConfig })} /></TabsContent>
              <TabsContent value="headers" className="m-0"><KvEditor rows={draft.headers} onChange={(headers) => store.patchDraft({ headers })} keyPlaceholder="Header" /></TabsContent>
              <TabsContent value="body" className="m-0 h-full"><BodyEditor bodyType={draft.bodyType} body={draft.body} onChange={(p) => store.patchDraft(p)} /></TabsContent>
              <TabsContent value="tests" className="m-0"><AssertionsEditor assertions={draft.assertions} onChange={(assertions) => store.patchDraft({ assertions })} /></TabsContent>
            </div>
          </Tabs>
        </div>

        {/* ── Response ── */}
        <div className="min-h-0 flex-1 basis-[54%]">
          <ResponseViewer
            response={response}
            sending={sending}
            error={sendError}
            aiBusy={aiBusy}
            onExplainError={aiExplain}
            onGenerateTests={aiTestsGenerate}
          />
        </div>
      </div>

      {/* ── AI: generate request ── */}
      <Dialog open={aiDialog === "generate"} onOpenChange={(v) => !v && setAiDialog(null)}>
        <DialogContent title="Generate request with AI" description="Describe the endpoint — APIForge builds the request.">
          <div className="space-y-3">
            <Textarea
              autoFocus
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={'e.g. "Create a POST request to register a new user with name, email and password"'}
              className="min-h-24"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAiDialog(null)}>Close</Button>
              <Button variant="primary" onClick={aiGenerateRequest} disabled={aiBusy || !aiPrompt.trim()}>
                {aiBusy ? "Generating…" : "Generate"}
              </Button>
            </div>
            {aiOutput && (
              <div className="rounded-[var(--radius-sm)] border border-border bg-surface-2 p-3">
                <pre className="max-h-64 overflow-auto font-mono text-[11.5px] text-fg-muted whitespace-pre-wrap">{aiOutput}</pre>
                {!aiOutput.startsWith("Error") && (
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="primary" onClick={applyGenerated}><Check size={13} /> Apply to builder</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI: explain error ── */}
      <Dialog open={aiDialog === "explain"} onOpenChange={(v) => !v && setAiDialog(null)}>
        <DialogContent title="AI diagnosis" className="max-w-2xl">
          {aiBusy ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-fg-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-fg-faint border-t-accent" />Analyzing request and response…</div>
          ) : (
            <MarkdownLite text={aiOutput} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── AI: generated tests ── */}
      <Dialog open={aiDialog === "tests"} onOpenChange={(v) => !v && setAiDialog(null)}>
        <DialogContent title="Generated assertions" description="Review and apply to this request's Tests tab." className="max-w-2xl">
          {aiBusy ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-fg-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-fg-faint border-t-accent" />Analyzing response shape…</div>
          ) : (
            <div className="space-y-2">
              {(aiTests ?? []).map((a, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2 font-mono text-[12px]">
                  <Badge tone="accent">{a.type}</Badge>
                  <span className="text-fg-muted">{a.target ?? ""}</span>
                  <span className="text-fg-faint">{a.operator ?? ""}</span>
                  <span className="truncate text-fg">{a.expected ?? ""}</span>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setAiDialog(null)}>Cancel</Button>
                <Button variant="primary" onClick={() => {
                  store.patchDraft({ assertions: [...draft.assertions, ...(aiTests ?? [])] });
                  setAiDialog(null);
                  setTab("tests");
                  toast.success(`${aiTests?.length ?? 0} assertions added`);
                }}>
                  <Check size={13} /> Apply assertions
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Save-as dialog ── */}
      <SaveAsDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        collections={project?.collections ?? []}
        initialName={draft.name}
        onSave={save}
      />
    </div>
  );
}

function SaveAsDialog({ open, onOpenChange, collections, initialName, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collections: { id: string; name: string; folders?: { id: string; name: string; parentId?: string | null }[] }[];
  initialName: string;
  onSave: (target: { collectionId: string; folderId?: string | null; name: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [collectionId, setCollectionId] = useState("");
  const [folderId, setFolderId] = useState("");
  const col = collections.find((c) => c.id === collectionId);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setCollectionId(collections[0]?.id ?? "");
      setFolderId("");
    }
  }, [open, initialName, collections]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save request" description="Choose where this request lives.">
        <form className="space-y-3.5" onSubmit={async (e) => {
          e.preventDefault();
          await onSave({ collectionId, folderId: folderId || null, name });
          onOpenChange(false);
        }}>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-fg-muted">Collection</span>
              <select value={collectionId} onChange={(e) => { setCollectionId(e.target.value); setFolderId(""); }} className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 text-[13px] text-fg focus:border-accent/50 focus:outline-none">
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-fg-muted">Folder</span>
              <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 text-[13px] text-fg focus:border-accent/50 focus:outline-none">
                <option value="">— root —</option>
                {(col?.folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-fg-muted">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2.5 text-[13px] text-fg focus:border-accent/50 focus:outline-none" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || !collectionId}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
