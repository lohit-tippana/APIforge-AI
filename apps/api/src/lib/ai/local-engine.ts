// Built-in heuristic generation engine. This is real analysis code — it
// parses natural language and JSON payloads to produce structured output.
// It runs when no LLM key is configured and is labeled as such in the UI.

const HTTP_VERBS: Record<string, string> = {
  get: "GET", list: "GET", fetch: "GET", retrieve: "GET", read: "GET", search: "GET", find: "GET",
  create: "POST", add: "POST", register: "POST", signup: "POST", "sign up": "POST", login: "POST", "log in": "POST",
  submit: "POST", send: "POST", upload: "POST", checkout: "POST", pay: "POST",
  update: "PUT", replace: "PUT", edit: "PATCH", modify: "PATCH", patch: "PATCH", rename: "PATCH",
  delete: "DELETE", remove: "DELETE", destroy: "DELETE",
};

const FIELD_PATTERNS: Record<string, unknown> = {
  name: "Jane Doe", full_name: "Jane Doe", first_name: "Jane", last_name: "Doe", username: "janedoe",
  email: "jane@example.com", password: "s3cure-password", password_confirmation: "s3cure-password",
  title: "Sample title", description: "Sample description", price: 49.99, amount: 4999, quantity: 1,
  currency: "usd", status: "active", id: 1, user_id: 1, order_id: 1, product_id: 1,
  phone: "+1-555-0100", address: "100 Main St", city: "Springfield", country: "US", zip: "00000",
  sku: "SKU-1001", token: "{{TOKEN}}", role: "user", active: true, limit: 20, offset: 0, page: 1,
};

const KNOWN_FIELDS = Object.keys(FIELD_PATTERNS);

function detectMethod(text: string): string {
  const lower = text.toLowerCase();
  const explicit = lower.match(/\b(get|post|put|patch|delete|head|options)\b/);
  if (explicit) return explicit[1].toUpperCase();
  // Prefer the earliest verb match in the sentence.
  let best: { idx: number; method: string } | null = null;
  for (const [verb, method] of Object.entries(HTTP_VERBS)) {
    const idx = lower.indexOf(verb);
    if (idx !== -1 && (!best || idx < best.idx)) best = { idx, method };
  }
  return best?.method ?? "GET";
}

function extractPath(text: string): string {
  const urlMatch = text.match(/(?:https?:\/\/[\w.-]+)?(\/[a-zA-Z0-9\-_{}./:]+)/);
  if (urlMatch) return urlMatch[1].replace(/\/{2,}/g, "/");
  // Derive resource from nouns: "register a new user" → /users/register
  const lower = text.toLowerCase();
  const resourceMatch = lower.match(/\b(user|users|product|products|order|orders|payment|payments|customer|customers|item|items|post|posts|comment|comments|task|tasks|invoice|invoices|session|auth|account|accounts|file|files|webhook|webhooks)\b/);
  const resource = resourceMatch ? `/${resourceMatch[1].replace(/s$/, "")}s` : "/resource";
  const isAction = /\b(register|login|log in|signup|sign up|checkout|pay|upload)\b/.test(lower);
  if (isAction) {
    const action = lower.match(/\b(register|login|signup|checkout|upload)\b/)?.[1] ?? (lower.includes("sign up") ? "signup" : lower.includes("log in") ? "login" : "create");
    return `${resource}/${action}`;
  }
  const hasId = /\b(by id|with id|\bid\b|single|specific|a user|a product|an order|the order)\b/.test(lower);
  return hasId ? `${resource}/{{id}}` : resource;
}

function extractFields(text: string): Record<string, unknown> {
  const lower = text.toLowerCase();
  const body: Record<string, unknown> = {};
  const withMatch = lower.match(/with\s+([a-z0-9_,\s and]+)/);
  const candidates = withMatch ? withMatch[1].split(/,|\band\b/) : [];
  for (const raw of candidates) {
    const field = raw.trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (field && field.length < 40) body[field] = FIELD_PATTERNS[field] ?? `sample-${field}`;
  }
  if (Object.keys(body).length === 0) {
    for (const f of KNOWN_FIELDS) {
      if (new RegExp(`\\b${f.replace(/_/g, "[_ ]")}\\b`).test(lower)) body[f] = FIELD_PATTERNS[f];
    }
  }
  return body;
}

function generateRequest(text: string): string {
  const method = detectMethod(text);
  const path = extractPath(text);
  const fields = extractFields(text);
  const baseUrl = text.match(/https?:\/\/[\w.-]+/)?.[0] ?? "{{BASE_URL}}";
  const hasBody = ["POST", "PUT", "PATCH"].includes(method);
  const result = {
    name: text.slice(0, 80),
    method,
    url: `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    headers: hasBody ? [{ key: "Content-Type", value: "application/json", enabled: true }] : [],
    params: [] as { key: string; value: string; enabled: boolean }[],
    bodyType: hasBody ? "JSON" : "NONE",
    body: hasBody ? JSON.stringify(Object.keys(fields).length ? fields : { name: "sample" }, null, 2) : null,
  };
  if (method === "GET" && /\b(search|filter|query)\b/i.test(text)) {
    result.params.push({ key: "q", value: "", enabled: true });
  }
  return JSON.stringify(result);
}

function inferSchema(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return { type: "array", items: value.length ? inferSchema(value[0]) : {} };
  }
  switch (typeof value) {
    case "object": {
      const obj = value as Record<string, unknown>;
      return {
        type: "object",
        required: Object.keys(obj),
        properties: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, inferSchema(v)])),
      };
    }
    case "number": return { type: Number.isInteger(value) ? "integer" : "number" };
    case "string": return { type: "string" };
    case "boolean": return { type: "boolean" };
    default: return {};
  }
}

function generateTests(input: string): string {
  let status = 200;
  let body: unknown = null;
  let headers: { key: string; value: string }[] = [];
  let timeMs = 200;
  try {
    const parsed = JSON.parse(input);
    status = parsed.status ?? status;
    headers = parsed.headers ?? [];
    timeMs = parsed.timeMs ?? timeMs;
    body = typeof parsed.body === "string" ? JSON.parse(parsed.body) : parsed.body;
  } catch {
    /* fall through with defaults */
  }

  const assertions: { type: string; target?: string; operator?: string; expected?: string; enabled: boolean }[] = [
    { type: "STATUS", operator: "EQ", expected: String(status < 400 ? status : 200), enabled: true },
    { type: "RESPONSE_TIME", operator: "LT", expected: String(Math.max(500, Math.ceil(timeMs * 2 / 100) * 100)), enabled: true },
  ];

  if (headers.some((h) => h.key.toLowerCase() === "content-type")) {
    assertions.push({ type: "HEADER_EXISTS", target: "content-type", enabled: true });
  }

  if (body && typeof body === "object") {
    if (Array.isArray(body)) {
      assertions.push({ type: "JSON_TYPE", target: "", expected: "array", enabled: true });
      if (body.length && typeof body[0] === "object" && body[0] !== null) {
        for (const key of Object.keys(body[0]).slice(0, 5)) {
          assertions.push({ type: "JSON_EXISTS", target: `[0].${key}`, enabled: true });
        }
      }
    } else {
      for (const [key, value] of Object.entries(body).slice(0, 6)) {
        assertions.push({ type: "JSON_EXISTS", target: key, enabled: true });
        const t = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
        assertions.push({ type: "JSON_TYPE", target: key, expected: t, enabled: true });
      }
    }
  }
  return JSON.stringify({ assertions });
}

const STATUS_GUIDANCE: Record<number, { cause: string; fix: string }> = {
  400: { cause: "The server rejected the request as malformed — usually an invalid JSON body, a missing required field, or a bad query parameter.", fix: "Validate the request body against the API schema, check Content-Type is application/json, and confirm every required field is present." },
  401: { cause: "Authentication failed — the credentials were missing, expired, or incorrect.", fix: "Check the Authorization tab: confirm the bearer token or API key is set, not expired, and is being sent in the right header. Verify {{TOKEN}}-style variables resolve in the active environment." },
  403: { cause: "Authenticated but not authorized — the credentials are valid but lack permission for this resource.", fix: "Confirm the token's scope/role covers this endpoint, and that the account has access to the resource. Compare the API key type (publishable vs secret, sandbox vs live)." },
  404: { cause: "No route matched — the path is wrong, the resource was deleted, or a path parameter doesn't exist.", fix: "Check for typos in the URL, verify path variables ({{id}}) resolve to real values, and confirm the API version prefix (e.g. /v1)." },
  405: { cause: "The endpoint exists but doesn't accept this HTTP method.", fix: "Check the API docs for the correct method — a common cause is PUT vs PATCH, or POSTing to a GET-only route." },
  409: { cause: "Conflict — usually a uniqueness violation (duplicate email/slug) or a state conflict.", fix: "Check whether the resource already exists. For retries, use idempotency keys or fetch-then-update instead." },
  422: { cause: "The request was well-formed but failed semantic validation.", fix: "Look at the response body's errors field for per-field validation failures and fix types/formats accordingly." },
  429: { cause: "Rate limited.", fix: "Respect the Retry-After header if present, add exponential backoff, and check the API's rate limit policy." },
  500: { cause: "Server-side error — the API itself crashed handling this request.", fix: "Retry once; if it persists, report it. Check whether a specific field value triggers it (often a null or unexpected type)." },
  502: { cause: "Bad gateway — a proxy or load balancer got an invalid response from the upstream service.", fix: "Usually transient/infrastructure-related. Retry, and check the provider's status page." },
  503: { cause: "Service unavailable — the server is overloaded or down for maintenance.", fix: "Retry with backoff and check the Retry-After header." },
};

function explainError(input: string): string {
  let status = 0;
  let reqUrl = "";
  let method = "";
  let authType = "NONE";
  let responseHeaders: { key: string; value: string }[] = [];
  let responseBody = "";
  try {
    const p = JSON.parse(input);
    status = p.response?.status ?? 0;
    responseBody = p.response?.body ?? "";
    responseHeaders = p.response?.headers ?? [];
    reqUrl = p.request?.url ?? "";
    method = p.request?.method ?? "";
    authType = p.request?.authType ?? "NONE";
  } catch {
    /* ignore */
  }

  const guide = STATUS_GUIDANCE[status];
  const lines: string[] = [];
  lines.push(`## ${method} ${reqUrl} → ${status}`);
  if (guide) {
    lines.push(`**Likely cause.** ${guide.cause}`, `**How to fix.** ${guide.fix}`);
  } else if (status === 0) {
    lines.push("**Likely cause.** The request never completed — DNS failure, connection refused, timeout, or a blocked request.", "**How to fix.** Verify the host is reachable, the port is correct, and the URL scheme is http/https. If it's a local service, confirm it's running.");
  }
  if (status === 401 && authType === "NONE") {
    lines.push("**Note.** This request is configured with **No Auth** — most 401s are resolved by adding credentials in the Authorization tab.");
  }
  const wwwAuth = responseHeaders.find((h) => h.key.toLowerCase() === "www-authenticate");
  if (wwwAuth) lines.push(`**Server hint.** The API sent \`WWW-Authenticate: ${wwwAuth.value}\`, which describes the expected auth scheme.`);
  const retryAfter = responseHeaders.find((h) => h.key.toLowerCase() === "retry-after");
  if (retryAfter) lines.push(`**Server hint.** \`Retry-After: ${retryAfter.value}\` — wait that long before retrying.`);
  try {
    const body = JSON.parse(responseBody);
    const errField = body.error ?? body.message ?? body.errors;
    if (errField) lines.push("**Server response.**", "```json", JSON.stringify(errField, null, 2), "```");
  } catch {
    /* non-JSON body */
  }
  return lines.join("\n\n");
}

function generateDocs(input: string): string {
  let parsed: { name?: string; method?: string; url?: string; headers?: { key: string; value: string }[]; params?: { key: string; value: string }[]; bodyType?: string; body?: string; response?: { status?: number; body?: string } };
  try {
    parsed = JSON.parse(input);
  } catch {
    return "# API Documentation\n\nNo request data was provided.";
  }
  const lines = [`## \`${parsed.method ?? "GET"} ${parsed.url ?? "/"}\``, ""];
  if (parsed.name) lines.push(`**${parsed.name}**`, "");
  if (parsed.params?.length) {
    lines.push("### Query parameters", "", "| Name | Value |", "| --- | --- |");
    for (const p of parsed.params) lines.push(`| \`${p.key}\` | ${p.value} |`);
    lines.push("");
  }
  if (parsed.headers?.length) {
    lines.push("### Headers", "", "| Name | Value |", "| --- | --- |");
    for (const h of parsed.headers) lines.push(`| \`${h.key}\` | ${h.value} |`);
    lines.push("");
  }
  if (parsed.body && parsed.bodyType !== "NONE") {
    lines.push("### Request body", "", "```json", parsed.body, "```", "");
  }
  if (parsed.response?.status) {
    lines.push(`### Response — ${parsed.response.status}`, "", "```json", parsed.response.body?.slice(0, 4000) ?? "", "```");
  }
  return lines.join("\n");
}

function mockResponse(input: string): string {
  let path = "/resource";
  try {
    const p = JSON.parse(input);
    path = new URL(p.url?.includes("{{") ? `https://api.example.com${p.url.replace("{{BASE_URL}}", "")}` : p.url).pathname;
  } catch {
    /* default path */
  }
  const resource = path.split("/").filter(Boolean).pop()?.replace(/[{}]/g, "") ?? "item";
  const singular = resource.replace(/s$/, "");
  const isCollection = !/\d+$|\{\{/.test(path);
  const item = {
    id: 42,
    [`${singular}_name`]: `Sample ${singular}`,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return JSON.stringify(isCollection ? { data: [item], total: 1, page: 1 } : item, null, 2);
}

function explainResponse(input: string): string {
  try {
    const p = JSON.parse(input);
    const lines = [`This response returned **${p.status}** in **${p.timeMs}ms** (${(p.sizeBytes / 1024).toFixed(1)} KB).`];
    const ct = (p.headers ?? []).find((h: { key: string }) => h.key.toLowerCase() === "content-type");
    if (ct) lines.push(`The body is \`${ct.value}\`.`);
    try {
      const body = JSON.parse(p.body);
      if (Array.isArray(body)) lines.push(`It contains a JSON array with **${body.length}** items.`);
      else if (body && typeof body === "object") {
        const keys = Object.keys(body);
        lines.push(`It contains a JSON object with ${keys.length} top-level field${keys.length === 1 ? "" : "s"}: ${keys.slice(0, 8).map((k) => `\`${k}\``).join(", ")}${keys.length > 8 ? ", …" : ""}.`);
      }
    } catch {
      lines.push("The body is not valid JSON.");
    }
    return lines.join("\n\n");
  } catch {
    return "Could not analyze the response — it may be empty.";
  }
}

export function localGenerate(system: string, input: string, opts?: { json?: boolean }): string {
  const task = system.match(/task:([\w-]+)/)?.[1] ?? "chat";
  switch (task) {
    case "generate-request": return generateRequest(input);
    case "generate-tests": return generateTests(input);
    case "generate-schema": {
      try {
        return JSON.stringify(inferSchema(JSON.parse(input.match(/```json\n([\s\S]*?)```/)?.[1] ?? input)), null, 2);
      } catch {
        return JSON.stringify({ type: "object" });
      }
    }
    case "mock-response": return mockResponse(input);
    case "explain-error": return explainError(input);
    case "generate-docs": return generateDocs(input);
    case "explain-response": return explainResponse(input);
    default:
      return opts?.json ? "{}" : "I can help you generate requests, generate tests, explain errors, document endpoints, infer JSON schemas, and create mock responses. Describe what you need — for example, \"create a POST request to register a user with name, email and password\".";
  }
}
