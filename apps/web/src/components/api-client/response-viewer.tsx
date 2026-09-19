"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Download, FileSearch, Sparkles, WrapText } from "lucide-react";
import { cn, formatBytes, formatDuration, statusColor } from "@/lib/utils";
import type { ExecutedResponse } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ScrollArea, Tooltip } from "@/components/ui/misc";
import { toast } from "sonner";

// ── Collapsible JSON tree ───────────────────────────────────

function JsonNode({ k, value, depth, defaultOpen }: { k?: string; value: unknown; depth: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen && depth < 2);
  const isObj = value !== null && typeof value === "object";
  const pad = { paddingLeft: depth * 14 };

  if (!isObj) {
    return (
      <div className="leading-[1.7]" style={pad}>
        {k !== undefined && <span className="text-[#8ab4f8]">{`"${k}"`}: </span>}
        <JsonLeaf value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  const bracket = Array.isArray(value) ? "[]" : "{}";
  return (
    <div style={pad}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-0.5 hover:bg-surface-3 rounded px-0.5 -ml-1">
        <ChevronRight size={11} className={cn("text-fg-faint transition-transform", open && "rotate-90")} />
        {k !== undefined && <span className="text-[#8ab4f8]">{`"${k}"`}: </span>}
        <span className="text-fg-faint">{bracket[0]}{!open && ` … ${entries.length} ${Array.isArray(value) ? "items" : "keys"} `}{!open && bracket[1]}</span>
      </button>
      {open && (
        <div className="border-l border-border/50 ml-1">
          {entries.map(([key, v]) => (
            <JsonNode key={key} k={Array.isArray(value) ? key : key} value={v} depth={0} defaultOpen={defaultOpen} />
          ))}
        </div>
      )}
      {open && <div className="text-fg-faint">{bracket[1]}</div>}
    </div>
  );
}

function JsonLeaf({ value }: { value: unknown }) {
  if (typeof value === "string") return <span className="text-[#98c379]">{`"${value}"`}</span>;
  if (typeof value === "number") return <span className="text-[#d19a66]">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="text-[#c678dd]">{String(value)}</span>;
  if (value === null) return <span className="text-fg-faint">null</span>;
  return <span>{String(value)}</span>;
}

export function JsonTree({ text }: { text: string }) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }, [text]);
  if (parsed === undefined) return <pre className="whitespace-pre-wrap break-all leading-[1.7]">{text || "(empty)"}</pre>;
  return <JsonNode value={parsed} depth={0} defaultOpen />;
}

// ── Response viewer ─────────────────────────────────────────

export function ResponseViewer({
  response,
  sending,
  error,
  onExplainError,
  onGenerateTests,
  aiBusy,
}: {
  response: ExecutedResponse | null;
  sending: boolean;
  error: string | null;
  onExplainError: () => void;
  onGenerateTests: () => void;
  aiBusy: boolean;
}) {
  const [mode, setMode] = useState<"pretty" | "raw">("pretty");
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const download = () => {
    if (!response) return;
    const blob = new Blob([response.body], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "response.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isJson = useMemo(() => {
    const ct = response?.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
    return ct.includes("json") || /^[\[{]/.test(response?.body.trim() ?? "");
  }, [response]);

  return (
    <div className="flex h-full flex-col border-t border-border bg-bg">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Response</span>
        {response && (
          <>
            <span className={cn("font-mono text-[12px] font-semibold", statusColor(response.status))}>
              {response.status} {response.statusText}
            </span>
            <span className="text-[11.5px] text-fg-muted">{formatDuration(response.timeMs)}</span>
            <span className="text-[11.5px] text-fg-muted">{formatBytes(response.sizeBytes)}</span>
            {response.bodyTruncated && <span className="text-[11px] text-warning">truncated</span>}
          </>
        )}
        {sending && <span className="text-[11.5px] text-fg-muted">Sending…</span>}
        <div className="flex-1" />
        {response && response.status >= 400 && (
          <Button size="sm" variant="ghost" onClick={onExplainError} disabled={aiBusy} className="text-accent hover:text-accent-strong">
            <Sparkles size={12} /> Explain error
          </Button>
        )}
        {response && (
          <Button size="sm" variant="ghost" onClick={onGenerateTests} disabled={aiBusy}>
            <Sparkles size={12} /> Generate tests
          </Button>
        )}
      </div>

      {error && (
        <div className="border-b border-danger/30 bg-danger-dim px-4 py-2.5">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[12.5px] text-danger">{error}</p>
            <Button size="sm" variant="ghost" onClick={onExplainError} disabled={aiBusy} className="shrink-0 text-accent">
              <Sparkles size={12} /> Explain
            </Button>
          </div>
        </div>
      )}

      {!response && !sending && !error && (
        <EmptyState
          icon={<FileSearch size={22} />}
          title="No response yet"
          description="Configure the request above and hit Send — or press Ctrl+Enter."
        />
      )}
      {sending && (
        <div className="flex flex-1 items-center justify-center gap-2.5 text-[12.5px] text-fg-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fg-faint border-t-accent" />
          Waiting for response…
        </div>
      )}

      {response && !sending && (
        <Tabs defaultValue="body" className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border pr-2">
            <TabsList className="border-b-0">
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="headers">Headers <span className="ml-1 text-fg-faint">{response.headers.length}</span></TabsTrigger>
              <TabsTrigger value="cookies">Cookies <span className="ml-1 text-fg-faint">{response.cookies.length}</span></TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-0.5">
              {isJson && (
                <>
                  <button onClick={() => setMode("pretty")} className={cn("rounded px-2 py-0.5 text-[11px]", mode === "pretty" ? "bg-surface-3 text-fg" : "text-fg-faint hover:text-fg")}>Pretty</button>
                  <button onClick={() => setMode("raw")} className={cn("rounded px-2 py-0.5 text-[11px]", mode === "raw" ? "bg-surface-3 text-fg" : "text-fg-faint hover:text-fg")}>Raw</button>
                </>
              )}
              <Tooltip content="Wrap lines">
                <button onClick={() => setWrap(!wrap)} className={cn("rounded p-1", wrap ? "text-accent" : "text-fg-faint hover:text-fg")}><WrapText size={13} /></button>
              </Tooltip>
              <Tooltip content="Copy body">
                <button onClick={() => copy(response.body)} className="rounded p-1 text-fg-faint hover:text-fg">{copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}</button>
              </Tooltip>
              <Tooltip content="Download">
                <button onClick={download} className="rounded p-1 text-fg-faint hover:text-fg"><Download size={13} /></button>
              </Tooltip>
            </div>
          </div>

          <TabsContent value="body" className="min-h-0 flex-1 overflow-auto m-0">
            <ScrollArea className="h-full">
              <div className={cn("p-3 font-mono text-[12px] leading-relaxed", !wrap && mode === "raw" && "whitespace-pre overflow-x-auto")}>
                {mode === "pretty" && isJson ? <JsonTree text={response.body} /> : <pre className={cn(wrap && "whitespace-pre-wrap break-all")}>{response.body || "(empty body)"}</pre>}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="headers" className="min-h-0 flex-1 overflow-auto m-0">
            <div className="p-2 font-mono text-[12px]">
              {response.headers.map((h, i) => (
                <div key={i} className="grid grid-cols-[minmax(140px,280px)_1fr] gap-3 border-b border-border/40 px-2 py-1">
                  <span className="truncate text-[#8ab4f8]">{h.key}</span>
                  <span className="break-all text-fg-muted">{h.value}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cookies" className="min-h-0 flex-1 overflow-auto m-0">
            {response.cookies.length === 0 ? (
              <p className="p-4 text-center text-[12.5px] text-fg-faint">No cookies in this response.</p>
            ) : (
              <div className="p-2 font-mono text-[12px]">
                {response.cookies.map((c, i) => (
                  <div key={i} className="grid grid-cols-[180px_1fr] gap-3 border-b border-border/40 px-2 py-1">
                    <span className="truncate text-[#8ab4f8]">{c.name}</span>
                    <span className="break-all text-fg-muted">{c.value}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
