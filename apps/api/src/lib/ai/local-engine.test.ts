import { describe, expect, it } from "vitest";
import { localGenerate } from "./local-engine";

describe("local AI engine", () => {
  it("generates a POST request from natural language", () => {
    const out = JSON.parse(localGenerate("task:generate-request", "Create a POST request to register a new user with name, email and password"));
    expect(out.method).toBe("POST");
    expect(out.url).toContain("{{BASE_URL}}");
    const body = JSON.parse(out.body);
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("email");
    expect(body).toHaveProperty("password");
  });

  it("generates GET requests", () => {
    const out = JSON.parse(localGenerate("task:generate-request", "List all products"));
    expect(out.method).toBe("GET");
    expect(out.url).toContain("/products");
  });

  it("generates assertions from a response", () => {
    const res = JSON.stringify({ status: 200, timeMs: 120, headers: [{ key: "content-type", value: "application/json" }], body: JSON.stringify({ users: [], total: 0 }) });
    const out = JSON.parse(localGenerate("task:generate-tests", res));
    expect(out.assertions.length).toBeGreaterThan(2);
    expect(out.assertions[0].type).toBe("STATUS");
  });

  it("explains 401s", () => {
    const out = localGenerate("task:explain-error", JSON.stringify({ request: { method: "GET", url: "https://x/me", authType: "NONE" }, response: { status: 401, headers: [], body: "" } }));
    expect(out).toContain("401");
    expect(out.toLowerCase()).toContain("auth");
  });

  it("infers JSON schemas", () => {
    const out = JSON.parse(localGenerate("task:generate-schema", JSON.stringify({ id: 1, tags: ["a"], ok: true })));
    expect(out.type).toBe("object");
    expect(out.properties.id.type).toBe("integer");
    expect(out.properties.tags.type).toBe("array");
  });
});
