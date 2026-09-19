import { request as undiciRequest } from "undici";
import { performance } from "node:perf_hooks";
import { config } from "../config";
import { prisma } from "./prisma";
import { interpolate, unresolvedVariables } from "./interpolate";

export interface ExecuteInput {
  method: string;
  url: string;
  headers?: { key: string; value: string; enabled?: boolean }[];
  params?: { key: string; value: string; enabled?: boolean }[];
  bodyType?: string;
  body?: string | null;
  authType?: string;
  authConfig?: Record<string, unknown> | null;
  environmentId?: string | null;
}

export interface ExecutedResponse {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: { key: string; value: string }[];
  cookies: { name: string; value: string; domain?: string; path?: string; expires?: string }[];
  body: string;
  bodyTruncated: boolean;
  request: { method: string; url: string; headers: { key: string; value: string }[]; body?: string };
}

const STATUS_TEXT: Record<number, string> = {
  100: "Continue", 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 304: "Not Modified",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 409: "Conflict", 422: "Unprocessable Entity",
  429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout",
};

async function loadEnvVars(environmentId?: string | null): Promise<Map<string, string>> {
  if (!environmentId) return new Map();
  const vars = await prisma.environmentVariable.findMany({
    where: { environmentId, enabled: true },
    select: { key: true, value: true },
  });
  return new Map(vars.map((v) => [v.key, v.value]));
}

interface FormRow {
  key: string;
  value: string;
  enabled?: boolean;
}

function parseFormRows(body: string): FormRow[] {
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function executeRequest(input: ExecuteInput): Promise<ExecutedResponse> {
  const vars = await loadEnvVars(input.environmentId);

  const url = interpolate(input.url.trim(), vars);
  const missing = unresolvedVariables(url, vars);
  if (!url) throw Object.assign(new Error("Request URL is empty"), { code: "EMPTY_URL" });
  if (missing.length) {
    throw Object.assign(new Error(`Unresolved environment variable(s): ${missing.join(", ")}`), { code: "UNRESOLVED_VARS" });
  }
  if (!/^https?:\/\//i.test(url)) {
    throw Object.assign(new Error("URL must start with http:// or https://"), { code: "BAD_URL" });
  }

  const headers = (input.headers ?? []).filter((h) => h.enabled !== false && h.key.trim());
  const headerMap = new Map<string, string>();
  for (const h of headers) headerMap.set(h.key.toLowerCase(), interpolate(h.value, vars));

  // ── Auth ──
  const authConfig = input.authConfig ?? {};
  let extraQuery: [string, string] | null = null;
  if (input.authType === "BEARER" && typeof authConfig.token === "string") {
    headerMap.set("authorization", `Bearer ${interpolate(authConfig.token, vars)}`);
  } else if (input.authType === "BASIC") {
    const u = interpolate(String(authConfig.username ?? ""), vars);
    const p = interpolate(String(authConfig.password ?? ""), vars);
    headerMap.set("authorization", `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`);
  } else if (input.authType === "APIKEY") {
    const key = interpolate(String(authConfig.key ?? ""), vars);
    const value = interpolate(String(authConfig.value ?? ""), vars);
    if (key) {
      if (authConfig.addTo === "query") extraQuery = [key, value];
      else headerMap.set(key.toLowerCase(), value);
    }
  }

  // ── Query params ──
  const target = new URL(url);
  for (const p of (input.params ?? []).filter((x) => x.enabled !== false && x.key.trim())) {
    target.searchParams.append(interpolate(p.key, vars), interpolate(p.value, vars));
  }
  if (extraQuery) target.searchParams.append(extraQuery[0], extraQuery[1]);

  // ── Body ──
  let body: string | Buffer | undefined;
  const bodyType = input.bodyType ?? "NONE";
  const rawBody = input.body ?? "";
  if (!["GET", "HEAD"].includes(input.method) && bodyType !== "NONE") {
    if (bodyType === "JSON") {
      body = interpolate(rawBody, vars);
      if (!headerMap.has("content-type")) headerMap.set("content-type", "application/json");
    } else if (bodyType === "URLENCODED") {
      const rows = parseFormRows(rawBody).filter((r) => r.enabled !== false && r.key.trim());
      body = new URLSearchParams(rows.map((r) => [interpolate(r.key, vars), interpolate(r.value, vars)] as [string, string])).toString();
      if (!headerMap.has("content-type")) headerMap.set("content-type", "application/x-www-form-urlencoded");
    } else if (bodyType === "FORM") {
      const rows = parseFormRows(rawBody).filter((r) => r.enabled !== false && r.key.trim());
      const fd = new FormData();
      for (const r of rows) fd.append(interpolate(r.key, vars), interpolate(r.value, vars));
      // Serialize multipart manually via undici's FormData support
      body = fd as unknown as Buffer;
    } else {
      body = interpolate(rawBody, vars); // RAW
    }
  }

  const headerRecord: Record<string, string> = Object.fromEntries(headerMap);
  if (!headerMap.has("user-agent")) headerRecord["user-agent"] = "APIForge/1.0";
  if (!headerMap.has("accept")) headerRecord["accept"] = "*/*";

  const started = performance.now();
  let res: Awaited<ReturnType<typeof undiciRequest>>;
  try {
    res = await undiciRequest(target.toString(), {
      method: input.method as never,
      headers: headerRecord,
      body,
      headersTimeout: config.executor.timeoutMs,
      bodyTimeout: config.executor.timeoutMs,
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const msg =
      err.code === "ENOTFOUND"
        ? `Could not resolve host "${target.hostname}"`
        : err.code === "ECONNREFUSED"
          ? `Connection refused by ${target.host}`
          : err.code === "UND_ERR_HEADERS_TIMEOUT" || err.code === "UND_ERR_BODY_TIMEOUT"
            ? `Request timed out after ${config.executor.timeoutMs / 1000}s`
            : err.message;
    throw Object.assign(new Error(msg), { code: "NETWORK" });
  }

  // Read body with a hard cap
  const chunks: Buffer[] = [];
  let size = 0;
  let truncated = false;
  for await (const chunk of res.body) {
    const buf = chunk as Buffer;
    if (size + buf.length > config.executor.maxResponseBytes) {
      chunks.push(buf.subarray(0, config.executor.maxResponseBytes - size));
      size = config.executor.maxResponseBytes;
      truncated = true;
      break;
    }
    chunks.push(buf);
    size += buf.length;
  }
  const timeMs = Math.round(performance.now() - started);
  const bodyText = Buffer.concat(chunks).toString("utf8");

  const responseHeaders: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(res.headers)) {
    if (Array.isArray(v)) v.forEach((x) => responseHeaders.push({ key: k, value: x }));
    else if (v !== undefined) responseHeaders.push({ key: k, value: String(v) });
  }

  const cookies = responseHeaders
    .filter((h) => h.key.toLowerCase() === "set-cookie")
    .map((h) => {
      const [pair, ...attrs] = h.value.split(";").map((s) => s.trim());
      const idx = pair.indexOf("=");
      const cookie: { name: string; value: string; domain?: string; path?: string; expires?: string } = {
        name: pair.slice(0, idx),
        value: pair.slice(idx + 1),
      };
      for (const attr of attrs) {
        const [ak, av] = attr.split("=").map((s) => s.trim());
        const lk = ak.toLowerCase();
        if (lk === "domain") cookie.domain = av;
        else if (lk === "path") cookie.path = av;
        else if (lk === "expires") cookie.expires = av;
      }
      return cookie;
    });

  return {
    status: res.statusCode,
    statusText: STATUS_TEXT[res.statusCode] ?? "",
    timeMs,
    sizeBytes: size,
    headers: responseHeaders,
    cookies,
    body: bodyText,
    bodyTruncated: truncated,
    request: {
      method: input.method,
      url: target.toString(),
      headers: Object.entries(headerRecord).map(([key, value]) => ({ key, value })),
      body: typeof body === "string" ? body : body ? "[multipart form data]" : undefined,
    },
  };
}
