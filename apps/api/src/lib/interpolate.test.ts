import { describe, expect, it } from "vitest";
import { extractVariables, interpolate, unresolvedVariables } from "./interpolate";

describe("interpolate", () => {
  const vars = new Map([["BASE_URL", "https://api.test"], ["TOKEN", "abc123"]]);

  it("replaces {{vars}}", () => {
    expect(interpolate("{{BASE_URL}}/users", vars)).toBe("https://api.test/users");
    expect(interpolate("Bearer {{ TOKEN }}", vars)).toBe("Bearer abc123");
  });

  it("leaves unknown vars untouched", () => {
    expect(interpolate("{{BASE_URL}}/{{MISSING}}", vars)).toBe("https://api.test/{{MISSING}}");
  });

  it("extracts and reports unresolved", () => {
    expect(extractVariables("{{A}}/{{B}}")).toEqual(["A", "B"]);
    expect(unresolvedVariables("{{BASE_URL}}/{{MISSING}}", vars)).toEqual(["MISSING"]);
  });
});
