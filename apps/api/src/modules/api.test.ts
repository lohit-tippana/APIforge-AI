// Integration tests for critical API flows. Requires a reachable DATABASE_URL
// (uses the same dev DB — run `prisma migrate dev` first).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

const app = createApp();
const agent = () => request.agent(app).set("x-requested-with", "fetch");

const stamp = Date.now();
const user = { name: "Test User", email: `test-${stamp}@apiforge.test`, password: "passw0rd1" };

describe("API integration", () => {
  let cookies: string[];
  let workspaceId: string;
  let projectId: string;
  let collectionId: string;
  let requestId: string;
  let envId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: user.email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: user.email } });
    await prisma.$disconnect();
  });

  it("registers a user and sets cookies", async () => {
    const res = await agent().post("/api/auth/register").send(user);
    expect(res.status).toBe(201);
    cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.join(";")).toContain("af_access");
  });

  it("rejects duplicate registration", async () => {
    const res = await agent().post("/api/auth/register").send(user);
    expect(res.status).toBe(400);
  });

  it("returns the session via /me", async () => {
    const res = await agent().get("/api/auth/me").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("creates a workspace", async () => {
    const res = await agent().post("/api/workspaces").set("Cookie", cookies).send({ name: "Test WS" });
    expect(res.status).toBe(201);
    workspaceId = res.body.workspace.id;
  });

  it("creates a project with default environments", async () => {
    const res = await agent().post("/api/projects").set("Cookie", cookies).send({ workspaceId, name: "Test Project" });
    expect(res.status).toBe(201);
    projectId = res.body.project.id;
    expect(res.body.project.environments.length).toBe(3);
    envId = res.body.project.environments[0].id;
  });

  it("stores env variables and masks secrets", async () => {
    const res = await agent().put(`/api/environments/${envId}/variables`).set("Cookie", cookies).send({
      variables: [
        { key: "BASE_URL", value: "https://dummyjson.com", isSecret: false, enabled: true },
        { key: "TOKEN", value: "s3cr3t", isSecret: true, enabled: true },
      ],
    });
    expect(res.status).toBe(200);
    const env = await agent().get(`/api/environments/${envId}`).set("Cookie", cookies);
    const token = env.body.environment.variables.find((v: { key: string }) => v.key === "TOKEN");
    expect(token.value).toBe(""); // masked
  });

  it("creates a collection and request", async () => {
    const c = await agent().post("/api/collections").set("Cookie", cookies).send({ projectId, name: "Test Collection" });
    expect(c.status).toBe(201);
    collectionId = c.body.collection.id;

    const r = await agent().post("/api/requests").set("Cookie", cookies).send({
      collectionId,
      name: "List products",
      method: "GET",
      url: "{{BASE_URL}}/products",
      params: [{ key: "limit", value: "3", enabled: true }],
      headers: [],
      assertions: [{ type: "STATUS", operator: "EQ", expected: "200", enabled: true }],
    });
    expect(r.status).toBe(201);
    requestId = r.body.request.id;
  });

  it("executes a request with env interpolation (real HTTP to dummyjson)", async () => {
    const res = await agent().post("/api/execute").set("Cookie", cookies).send({
      projectId,
      requestId,
      environmentId: envId,
      method: "GET",
      url: "{{BASE_URL}}/products",
      params: [{ key: "limit", value: "3", enabled: true }],
      headers: [],
      bodyType: "NONE",
      authType: "NONE",
    });
    expect(res.status).toBe(200);
    expect(res.body.response.status).toBe(200);
    expect(res.body.response.timeMs).toBeGreaterThan(0);
    expect(res.body.response.request.url).toContain("dummyjson.com/products?limit=3");
    expect(res.body.response.request.url).not.toContain("{{");
  }, 20000);

  it("records history", async () => {
    const res = await agent().get(`/api/projects/${projectId}/history`).set("Cookie", cookies);
    expect(res.body.history.length).toBeGreaterThan(0);
  });

  it("runs the collection and evaluates assertions", async () => {
    const res = await agent().post("/api/test-runs").set("Cookie", cookies).send({ collectionId, environmentId: envId });
    expect(res.status).toBe(201);
    expect(res.body.testRun.status).toBe("PASSED");
    expect(res.body.testRun.results[0].statusCode).toBe(200);
  }, 30000);

  it("enforces authorization — stranger cannot read the workspace", async () => {
    const other = { name: "Other", email: `other-${stamp}@apiforge.test`, password: "passw0rd1" };
    const reg = await agent().post("/api/auth/register").send(other);
    const res = await agent().get(`/api/projects/${projectId}`).set("Cookie", reg.headers["set-cookie"]);
    expect(res.status).toBe(404);
    await prisma.user.deleteMany({ where: { email: other.email } });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/workspaces");
    expect(res.status).toBe(401);
  });

  it("rejects mutations without the CSRF header", async () => {
    const res = await request(app).post("/api/workspaces").set("Cookie", cookies).send({ name: "x" });
    expect(res.status).toBe(403);
  });

  it("AI generate-request produces a structured spec", async () => {
    const res = await agent().post("/api/ai/generate-request").set("Cookie", cookies).send({ prompt: "Create a POST request to register a user with name, email and password" });
    expect(res.status).toBe(200);
    expect(res.body.request.method).toBe("POST");
    expect(res.body.request.url).toContain("{{BASE_URL}}");
  });
});
