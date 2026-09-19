import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { getProvider, type ChatMessage } from "../../lib/ai/provider";
import { badRequest } from "../../lib/errors";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const aiLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
aiRouter.use(aiLimiter);

aiRouter.get("/status", (_req, res) => {
  const p = getProvider();
  res.json({ provider: p.name, isLLM: p.isLLM });
});

async function complete(task: string, input: string, json = false): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: `You are the APIForge AI assistant for API development. task:${task}\nRespond with ${json ? "valid JSON only — no prose, no code fences" : "concise technical markdown"}.` },
    { role: "user", content: input },
  ];
  return getProvider().complete(messages, { json });
}

function parseJson<T>(raw: string, what: string): T {
  // Strip code fences an LLM might add despite instructions.
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw badRequest(`AI returned malformed ${what} — try regenerating`);
  }
}

const promptSchema = z.object({ prompt: z.string().min(3).max(4000) });

aiRouter.post("/generate-request", validate({ body: promptSchema }), async (req, res, next) => {
  try {
    const raw = await complete("generate-request", req.body.prompt, true);
    res.json({ request: parseJson(raw, "request") });
  } catch (e) {
    next(e);
  }
});

const responseContextSchema = z.object({
  status: z.number(),
  timeMs: z.number().optional(),
  sizeBytes: z.number().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  body: z.string().max(100_000).default(""),
});

aiRouter.post("/generate-tests", validate({ body: z.object({ response: responseContextSchema }) }), async (req, res, next) => {
  try {
    const payload = JSON.stringify({ ...req.body.response, body: req.body.response.body.slice(0, 20_000) });
    const raw = await complete("generate-tests", payload, true);
    res.json(parseJson(raw, "assertions"));
  } catch (e) {
    next(e);
  }
});

const explainErrorSchema = z.object({
  request: z.object({
    method: z.string(), url: z.string(),
    authType: z.string().default("NONE"),
    headers: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
    body: z.string().nullable().optional(),
  }),
  response: responseContextSchema.nullable().optional(),
  error: z.string().optional(),
});

aiRouter.post("/explain-error", validate({ body: explainErrorSchema }), async (req, res, next) => {
  try {
    const input = JSON.stringify({
      request: req.body.request,
      response: req.body.response ? { ...req.body.response, body: req.body.response.body.slice(0, 10_000) } : null,
      error: req.body.error ?? null,
    });
    res.json({ explanation: await complete("explain-error", input) });
  } catch (e) {
    next(e);
  }
});

aiRouter.post("/explain-response", validate({ body: z.object({ response: responseContextSchema }) }), async (req, res, next) => {
  try {
    const input = JSON.stringify({ ...req.body.response, body: req.body.response.body.slice(0, 15_000) });
    res.json({ explanation: await complete("explain-response", input) });
  } catch (e) {
    next(e);
  }
});

const docsSchema = z.object({
  name: z.string().optional(),
  method: z.string(),
  url: z.string(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  params: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  bodyType: z.string().default("NONE"),
  body: z.string().nullable().optional(),
  authType: z.string().default("NONE"),
  response: responseContextSchema.nullable().optional(),
});

aiRouter.post("/generate-docs", validate({ body: docsSchema }), async (req, res, next) => {
  try {
    const input = JSON.stringify({ ...req.body, body: req.body.body?.slice(0, 10_000), response: req.body.response ? { ...req.body.response, body: req.body.response.body.slice(0, 10_000) } : null });
    res.json({ markdown: await complete("generate-docs", input) });
  } catch (e) {
    next(e);
  }
});

aiRouter.post("/generate-schema", validate({ body: z.object({ body: z.string().min(1).max(100_000) }) }), async (req, res, next) => {
  try {
    const raw = await complete("generate-schema", `\`\`\`json\n${req.body.body.slice(0, 30_000)}\n\`\`\``, true);
    res.json({ schema: parseJson(raw, "schema") });
  } catch (e) {
    next(e);
  }
});

aiRouter.post("/mock-response", validate({ body: z.object({ method: z.string(), url: z.string(), body: z.string().nullable().optional() }) }), async (req, res, next) => {
  try {
    const raw = await complete("mock-response", JSON.stringify(req.body), true);
    res.json({ body: raw });
  } catch (e) {
    next(e);
  }
});
