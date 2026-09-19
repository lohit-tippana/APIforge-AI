import { config } from "../../config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProvider {
  name: string;
  /** True when backed by a real LLM (vs the built-in heuristic engine). */
  isLLM: boolean;
  complete(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string>;
}

// ── OpenAI-compatible provider ──────────────────────────────

class OpenAIProvider implements AiProvider {
  name = "openai";
  isLLM = true;

  async complete(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string> {
    const res = await fetch(`${config.ai.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ai.openaiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.openaiModel,
        messages,
        temperature: 0.2,
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned an empty response");
    return content;
  }
}

// ── Local heuristic provider ────────────────────────────────
// Real generation code (not canned text): it analyzes inputs and produces
// structured output. Used when no LLM key is configured; clearly labeled.

class LocalProvider implements AiProvider {
  name = "local";
  isLLM = false;

  async complete(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string> {
    const task = messages.find((m) => m.role === "system")?.content ?? "";
    const input = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
    const { localGenerate } = await import("./local-engine");
    return localGenerate(task, input, opts);
  }
}

export function getProvider(): AiProvider {
  if (config.ai.provider === "openai" && config.ai.openaiKey) return new OpenAIProvider();
  return new LocalProvider();
}
