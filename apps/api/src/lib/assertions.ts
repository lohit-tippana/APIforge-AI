import type { ExecutedResponse } from "./executor";

export interface Assertion {
  type: string;
  target?: string | null;
  operator?: string | null;
  expected?: string | null;
  enabled?: boolean;
}

export interface AssertionResult {
  type: string;
  description: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  actual?: string;
  expected?: string;
}

// ── JSON path resolution: "a.b[0].c" ────────────────────────
export function resolvePath(obj: unknown, path: string): { found: boolean; value: unknown } {
  if (!path) return { found: true, value: obj };
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return { found: false, value: undefined };
    cur = (cur as Record<string, unknown>)[part];
  }
  return { found: cur !== undefined, value: cur };
}

// Minimal JSON-schema subset: type, required, properties, items.
export function validateSchema(value: unknown, schema: Record<string, unknown>, path = "$"): string[] {
  const errors: string[] = [];
  const type = schema.type as string | undefined;
  if (type) {
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (actual !== type && !(type === "integer" && actual === "number")) {
      errors.push(`${path}: expected type ${type}, got ${actual}`);
      return errors;
    }
  }
  if (type === "object" && typeof value === "object" && value !== null) {
    const required = (schema.required as string[]) ?? [];
    for (const key of required) {
      if (!(key in (value as Record<string, unknown>))) errors.push(`${path}: missing required property "${key}"`);
    }
    const props = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
    for (const [key, sub] of Object.entries(props)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) errors.push(...validateSchema(v, sub, `${path}.${key}`));
    }
  }
  if (type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validateSchema(item, schema.items as Record<string, unknown>, `${path}[${i}]`)));
  }
  return errors;
}

const num = (v: string | null | undefined) => Number(v);

function compare(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case "EQ": return actual === expected;
    case "NEQ": return actual !== expected;
    case "LT": return actual < expected;
    case "LTE": return actual <= expected;
    case "GT": return actual > expected;
    case "GTE": return actual >= expected;
    default: return actual === expected;
  }
}

export function evaluateAssertions(assertions: Assertion[], res: ExecutedResponse): AssertionResult[] {
  const results: AssertionResult[] = [];
  let parsedBody: unknown;
  let bodyParsed = false;
  const jsonBody = () => {
    if (!bodyParsed) {
      try {
        parsedBody = JSON.parse(res.body);
      } catch {
        parsedBody = undefined;
      }
      bodyParsed = true;
    }
    return parsedBody;
  };

  for (const a of assertions) {
    if (a.enabled === false) {
      results.push({ type: a.type, description: describe(a), status: "SKIPPED", expected: a.expected ?? undefined });
      continue;
    }
    const op = a.operator ?? "EQ";
    const expected = a.expected ?? "";
    let status: "PASSED" | "FAILED" = "FAILED";
    let actual = "";

    switch (a.type) {
      case "STATUS": {
        actual = String(res.status);
        status = compare(res.status, op, num(expected)) ? "PASSED" : "FAILED";
        break;
      }
      case "RESPONSE_TIME": {
        actual = `${res.timeMs}ms`;
        status = compare(res.timeMs, op === "EQ" ? "LT" : op, num(expected)) ? "PASSED" : "FAILED";
        break;
      }
      case "JSON_EXISTS": {
        const r = resolvePath(jsonBody(), a.target ?? "");
        status = r.found ? "PASSED" : "FAILED";
        actual = r.found ? JSON.stringify(r.value)?.slice(0, 200) : "path not found";
        break;
      }
      case "JSON_EQUALS": {
        const r = resolvePath(jsonBody(), a.target ?? "");
        if (!r.found) {
          actual = "path not found";
          break;
        }
        actual = JSON.stringify(r.value);
        let exp: unknown = expected;
        try {
          exp = JSON.parse(expected);
        } catch {
          /* keep string */
        }
        status = JSON.stringify(r.value) === JSON.stringify(exp) || String(r.value) === expected ? "PASSED" : "FAILED";
        break;
      }
      case "JSON_TYPE": {
        const r = resolvePath(jsonBody(), a.target ?? "");
        if (!r.found) {
          actual = "path not found";
          break;
        }
        actual = Array.isArray(r.value) ? "array" : r.value === null ? "null" : typeof r.value;
        status = actual === expected ? "PASSED" : "FAILED";
        break;
      }
      case "HEADER_EXISTS": {
        const name = (a.target ?? "").toLowerCase();
        const found = res.headers.find((h) => h.key.toLowerCase() === name);
        status = found ? "PASSED" : "FAILED";
        actual = found?.value ?? "header not found";
        break;
      }
      case "HEADER_EQUALS": {
        const name = (a.target ?? "").toLowerCase();
        const found = res.headers.find((h) => h.key.toLowerCase() === name);
        actual = found?.value ?? "header not found";
        status = found && compare(found.value.length, "GT", -1) && found.value === expected ? "PASSED" : "FAILED";
        if (found && op === "CONTAINS") status = found.value.includes(expected) ? "PASSED" : "FAILED";
        break;
      }
      case "BODY_CONTAINS": {
        actual = res.body.length > 120 ? `${res.body.slice(0, 120)}…` : res.body;
        status = res.body.includes(expected) ? "PASSED" : "FAILED";
        break;
      }
      case "SCHEMA": {
        try {
          const schema = JSON.parse(expected);
          const errors = validateSchema(jsonBody(), schema);
          status = errors.length === 0 ? "PASSED" : "FAILED";
          actual = errors.length ? errors.slice(0, 5).join("; ") : "valid";
        } catch {
          actual = "invalid schema JSON";
        }
        break;
      }
      default:
        actual = `unknown assertion type "${a.type}"`;
    }
    results.push({ type: a.type, description: describe(a), status, actual, expected });
  }
  return results;
}

export function describe(a: Assertion): string {
  const op = a.operator ?? "EQ";
  switch (a.type) {
    case "STATUS": return `Status ${op} ${a.expected}`;
    case "RESPONSE_TIME": return `Response time ${op} ${a.expected}ms`;
    case "JSON_EXISTS": return `${a.target} exists`;
    case "JSON_EQUALS": return `${a.target} equals ${a.expected}`;
    case "JSON_TYPE": return `${a.target} is ${a.expected}`;
    case "HEADER_EXISTS": return `Header ${a.target} exists`;
    case "HEADER_EQUALS": return `Header ${a.target} equals ${a.expected}`;
    case "BODY_CONTAINS": return `Body contains "${a.expected}"`;
    case "SCHEMA": return `Body matches JSON schema`;
    default: return a.type;
  }
}
