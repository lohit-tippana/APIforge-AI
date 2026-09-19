import { describe, expect, it } from "vitest";
import { evaluateAssertions, resolvePath, validateSchema } from "./assertions";
import type { ExecutedResponse } from "./executor";

const res = (over: Partial<ExecutedResponse> = {}): ExecutedResponse => ({
  status: 200,
  statusText: "OK",
  timeMs: 150,
  sizeBytes: 100,
  headers: [{ key: "content-type", value: "application/json" }],
  cookies: [],
  body: JSON.stringify({ users: [{ id: 1, name: "Ada" }], total: 1 }),
  bodyTruncated: false,
  request: { method: "GET", url: "https://x.test", headers: [] },
  ...over,
});

describe("resolvePath", () => {
  it("resolves nested and array paths", () => {
    const obj = { users: [{ id: 1 }], meta: { total: 5 } };
    expect(resolvePath(obj, "meta.total")).toEqual({ found: true, value: 5 });
    expect(resolvePath(obj, "users[0].id")).toEqual({ found: true, value: 1 });
    expect(resolvePath(obj, "users[5]")).toEqual({ found: false, value: undefined });
  });
});

describe("validateSchema", () => {
  it("validates type, required, nested properties", () => {
    const schema = { type: "object", required: ["id"], properties: { id: { type: "integer" }, name: { type: "string" } } };
    expect(validateSchema({ id: 1, name: "x" }, schema)).toEqual([]);
    expect(validateSchema({ name: "x" }, schema)[0]).toContain("missing required");
    expect(validateSchema({ id: "x" }, schema)[0]).toContain("expected type integer");
  });
});

describe("evaluateAssertions", () => {
  it("passes status assertions", () => {
    const [r] = evaluateAssertions([{ type: "STATUS", operator: "EQ", expected: "200" }], res());
    expect(r.status).toBe("PASSED");
  });

  it("fails mismatched status", () => {
    const [r] = evaluateAssertions([{ type: "STATUS", operator: "EQ", expected: "201" }], res());
    expect(r.status).toBe("FAILED");
    expect(r.actual).toBe("200");
  });

  it("checks response time", () => {
    const [r] = evaluateAssertions([{ type: "RESPONSE_TIME", operator: "LT", expected: "500" }], res());
    expect(r.status).toBe("PASSED");
  });

  it("checks JSON field existence and type", () => {
    const results = evaluateAssertions(
      [
        { type: "JSON_EXISTS", target: "users" },
        { type: "JSON_TYPE", target: "users", expected: "array" },
        { type: "JSON_EQUALS", target: "total", expected: "1" },
        { type: "JSON_EXISTS", target: "missing.path" },
      ],
      res(),
    );
    expect(results.map((r) => r.status)).toEqual(["PASSED", "PASSED", "PASSED", "FAILED"]);
  });

  it("checks headers and body", () => {
    const results = evaluateAssertions(
      [
        { type: "HEADER_EXISTS", target: "Content-Type" },
        { type: "HEADER_EQUALS", target: "content-type", expected: "application/json" },
        { type: "BODY_CONTAINS", expected: "Ada" },
      ],
      res(),
    );
    expect(results.every((r) => r.status === "PASSED")).toBe(true);
  });

  it("skips disabled assertions", () => {
    const [r] = evaluateAssertions([{ type: "STATUS", expected: "999", enabled: false }], res());
    expect(r.status).toBe("SKIPPED");
  });

  it("validates JSON schema assertions", () => {
    const schema = JSON.stringify({ type: "object", required: ["users"], properties: { users: { type: "array" } } });
    const [r] = evaluateAssertions([{ type: "SCHEMA", expected: schema }], res());
    expect(r.status).toBe("PASSED");
  });
});
