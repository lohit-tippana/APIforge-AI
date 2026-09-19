import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

const A = (type: string, extra: Record<string, unknown> = {}) => ({ type, enabled: true, ...extra });

async function main() {
  console.log("Seeding APIForge AI demo data…");

  // ── Users ──
  const demo = await prisma.user.upsert({
    where: { email: "demo@apiforge.dev" },
    update: {},
    create: { email: "demo@apiforge.dev", name: "Maya Chen", passwordHash: hashPassword("demo1234") },
  });
  const sam = await prisma.user.upsert({
    where: { email: "sam@acme.dev" },
    update: {},
    create: { email: "sam@acme.dev", name: "Sam Okafor", passwordHash: hashPassword("demo1234") },
  });
  const riley = await prisma.user.upsert({
    where: { email: "riley@acme.dev" },
    update: {},
    create: { email: "riley@acme.dev", name: "Riley Torres", passwordHash: hashPassword("demo1234") },
  });

  // ── Workspace ──
  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-engineering" },
    update: {},
    create: { name: "Acme Engineering", slug: "acme-engineering", icon: "⚡" },
  });
  for (const [user, role] of [[demo, "OWNER"], [sam, "DEVELOPER"], [riley, "VIEWER"]] as const) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role },
      create: { workspaceId: workspace.id, userId: user.id, role },
    });
  }

  // ── Project: E-Commerce API ──
  let project = await prisma.project.findFirst({ where: { workspaceId: workspace.id, slug: "e-commerce-api" } });
  if (project) {
    await prisma.project.delete({ where: { id: project.id } });
  }
  project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "E-Commerce API",
      slug: "e-commerce-api",
      description: "Storefront backend — auth, catalog, orders and payments.",
      environments: {
        create: [
          {
            name: "Development",
            isDefault: true,
            sortOrder: 0,
            variables: {
              create: [
                { key: "BASE_URL", value: "https://dummyjson.com", sortOrder: 0 },
                { key: "TOKEN", value: "", isSecret: true, sortOrder: 1 },
                { key: "API_VERSION", value: "v1", sortOrder: 2 },
              ],
            },
          },
          {
            name: "Staging",
            sortOrder: 1,
            variables: {
              create: [
                { key: "BASE_URL", value: "https://dummyjson.com", sortOrder: 0 },
                { key: "TOKEN", value: "", isSecret: true, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Production",
            sortOrder: 2,
            variables: {
              create: [
                { key: "BASE_URL", value: "https://dummyjson.com", sortOrder: 0 },
                { key: "TOKEN", value: "", isSecret: true, sortOrder: 1 },
              ],
            },
          },
        ],
      },
    },
  });

  // ── Collections ──
  const auth = await prisma.collection.create({
    data: { projectId: project.id, name: "Authentication", description: "Session tokens and identity.", sortOrder: 0 },
  });
  const catalog = await prisma.collection.create({
    data: { projectId: project.id, name: "Products", description: "Catalog browsing and management.", sortOrder: 1 },
  });
  const orders = await prisma.collection.create({
    data: { projectId: project.id, name: "Orders", description: "Cart and order lifecycle.", sortOrder: 2 },
  });

  const mkReq = (data: {
    collectionId: string; folderId?: string; name: string; method: string; url: string;
    bodyType?: string; body?: string; authType?: string; authConfig?: object;
    headers?: { key: string; value: string; enabled?: boolean }[];
    params?: { key: string; value: string; enabled?: boolean }[];
    assertions?: object[]; sortOrder?: number;
  }) =>
    prisma.request.create({
      data: {
        collectionId: data.collectionId,
        folderId: data.folderId ?? null,
        name: data.name,
        method: data.method,
        url: data.url,
        bodyType: data.bodyType ?? "NONE",
        body: data.body ?? null,
        authType: data.authType ?? "NONE",
        authConfig: data.authConfig ?? undefined,
        sortOrder: data.sortOrder ?? 0,
        createdById: demo.id,
        headers: { create: (data.headers ?? []).map((h, i) => ({ ...h, enabled: h.enabled ?? true, sortOrder: i })) },
        params: { create: (data.params ?? []).map((p, i) => ({ ...p, enabled: p.enabled ?? true, sortOrder: i })) },
        assertions: { create: (data.assertions ?? []).map((a, i) => ({ ...(a as object), sortOrder: i }) as never) },
      },
    });

  // Auth requests
  await mkReq({
    collectionId: auth.id, name: "Login", method: "POST", url: "{{BASE_URL}}/auth/login",
    bodyType: "JSON",
    body: JSON.stringify({ username: "emilys", password: "emilyspass", expiresInMins: 30 }, null, 2),
    headers: [{ key: "Content-Type", value: "application/json" }],
    assertions: [
      A("STATUS", { expected: "200" }),
      A("RESPONSE_TIME", { operator: "LT", expected: "3000" }),
      A("JSON_EXISTS", { target: "accessToken" }),
      A("JSON_TYPE", { target: "username", expected: "string" }),
    ],
  });
  await mkReq({
    collectionId: auth.id, name: "Get current user", method: "GET", url: "{{BASE_URL}}/auth/me",
    authType: "BEARER", authConfig: { token: "{{TOKEN}}" },
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EXISTS", { target: "id" })],
    sortOrder: 1,
  });
  await mkReq({
    collectionId: auth.id, name: "Refresh session", method: "POST", url: "{{BASE_URL}}/auth/refresh",
    bodyType: "JSON", body: JSON.stringify({ refreshToken: "{{REFRESH_TOKEN}}", expiresInMins: 30 }, null, 2),
    sortOrder: 2,
  });

  // Products folders
  const browse = await prisma.folder.create({ data: { collectionId: catalog.id, name: "Browse", sortOrder: 0 } });
  const manage = await prisma.folder.create({ data: { collectionId: catalog.id, name: "Manage", sortOrder: 1 } });

  await mkReq({
    collectionId: catalog.id, folderId: browse.id, name: "List products", method: "GET", url: "{{BASE_URL}}/products",
    params: [{ key: "limit", value: "12" }, { key: "select", value: "title,price,rating,stock", enabled: false }],
    assertions: [
      A("STATUS", { expected: "200" }),
      A("JSON_EXISTS", { target: "products" }),
      A("JSON_TYPE", { target: "products", expected: "array" }),
      A("JSON_TYPE", { target: "total", expected: "number" }),
    ],
  });
  await mkReq({
    collectionId: catalog.id, folderId: browse.id, name: "Get product", method: "GET", url: "{{BASE_URL}}/products/1",
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EXISTS", { target: "title" }), A("JSON_TYPE", { target: "price", expected: "number" })],
    sortOrder: 1,
  });
  await mkReq({
    collectionId: catalog.id, folderId: browse.id, name: "Search products", method: "GET", url: "{{BASE_URL}}/products/search",
    params: [{ key: "q", value: "phone" }],
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EXISTS", { target: "products" })],
    sortOrder: 2,
  });
  await mkReq({
    collectionId: catalog.id, folderId: manage.id, name: "Create product", method: "POST", url: "{{BASE_URL}}/products/add",
    bodyType: "JSON",
    body: JSON.stringify({ title: "Aurora Wireless Headphones", price: 129.99, category: "electronics", stock: 240 }, null, 2),
    headers: [{ key: "Content-Type", value: "application/json" }],
    assertions: [A("STATUS", { expected: "201" }), A("JSON_EXISTS", { target: "id" })],
  });
  await mkReq({
    collectionId: catalog.id, folderId: manage.id, name: "Update product", method: "PUT", url: "{{BASE_URL}}/products/1",
    bodyType: "JSON", body: JSON.stringify({ price: 99.99 }, null, 2),
    headers: [{ key: "Content-Type", value: "application/json" }],
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EQUALS", { target: "price", expected: "99.99" })],
    sortOrder: 1,
  });
  await mkReq({
    collectionId: catalog.id, folderId: manage.id, name: "Delete product", method: "DELETE", url: "{{BASE_URL}}/products/1",
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EQUALS", { target: "isDeleted", expected: "true" })],
    sortOrder: 2,
  });

  // Orders
  await mkReq({
    collectionId: orders.id, name: "List carts", method: "GET", url: "{{BASE_URL}}/carts",
    params: [{ key: "limit", value: "10" }],
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EXISTS", { target: "carts" })],
  });
  await mkReq({
    collectionId: orders.id, name: "Get cart", method: "GET", url: "{{BASE_URL}}/carts/1",
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EXISTS", { target: "products" }), A("JSON_TYPE", { target: "total", expected: "number" })],
    sortOrder: 1,
  });
  await mkReq({
    collectionId: orders.id, name: "Create order", method: "POST", url: "{{BASE_URL}}/carts/add",
    bodyType: "JSON",
    body: JSON.stringify({ userId: 5, products: [{ id: 144, quantity: 1 }, { id: 98, quantity: 2 }] }, null, 2),
    headers: [{ key: "Content-Type", value: "application/json" }],
    assertions: [A("STATUS", { expected: "201" }), A("JSON_EXISTS", { target: "id" })],
    sortOrder: 2,
  });

  // ── Second project ──
  const payments = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Internal Services",
      slug: "internal-services",
      description: "Health checks and internal tooling.",
      environments: {
        create: [{
          name: "Development", isDefault: true,
          variables: { create: [{ key: "BASE_URL", value: "https://dummyjson.com" }] },
        }],
      },
    },
  });
  const ops = await prisma.collection.create({ data: { projectId: payments.id, name: "Ops", sortOrder: 0 } });
  await mkReq({
    collectionId: ops.id, name: "Users directory", method: "GET", url: "{{BASE_URL}}/users",
    params: [{ key: "limit", value: "5" }],
    assertions: [A("STATUS", { expected: "200" }), A("JSON_EXISTS", { target: "users" })],
  });

  // ── History & test-run seed (plausible demo data) ──
  const now = Date.now();
  const historyRows = [];
  for (let i = 0; i < 60; i++) {
    const day = Math.floor(Math.random() * 21);
    historyRows.push({
      projectId: project.id,
      userId: [demo.id, sam.id][i % 2],
      method: ["GET", "GET", "GET", "POST", "PUT", "DELETE"][i % 6],
      url: `https://dummyjson.com/${["products", "carts", "auth/login", "products/1", "users"][i % 5]}`,
      statusCode: [200, 200, 200, 201, 200, 404, 200, 500][i % 8],
      responseTimeMs: 90 + Math.floor(Math.random() * 400),
      responseSize: 800 + Math.floor(Math.random() * 12000),
      createdAt: new Date(now - day * 86400000 - Math.floor(Math.random() * 43200000)),
    });
  }
  await prisma.requestHistory.createMany({ data: historyRows });

  const seededRun = await prisma.testRun.create({
    data: {
      projectId: project.id,
      collectionId: catalog.id,
      name: "Products run",
      status: "PASSED",
      totalRequests: 6,
      passed: 5,
      failed: 1,
      durationMs: 2140,
      triggeredById: demo.id,
      createdAt: new Date(now - 86400000),
    },
  });
  await prisma.testResult.create({
    data: {
      testRunId: seededRun.id, requestName: "List products", method: "GET", url: "https://dummyjson.com/products",
      status: "PASSED", statusCode: 200, responseTimeMs: 184, passed: 4, failed: 0, skipped: 0, sortOrder: 0,
      assertionLog: [
        { type: "STATUS", description: "Status EQ 200", status: "PASSED", actual: "200", expected: "200" },
        { type: "JSON_EXISTS", description: "products exists", status: "PASSED" },
      ] as never,
    },
  });

  // ── Activity ──
  const activityRows = [
    { userId: demo.id, action: "created", entityType: "workspace", entityName: "Acme Engineering" },
    { userId: demo.id, action: "created", entityType: "project", entityName: "E-Commerce API" },
    { userId: sam.id, action: "created", entityType: "collection", entityName: "Authentication" },
    { userId: sam.id, action: "updated", entityType: "request", entityName: "List products" },
    { userId: demo.id, action: "ran", entityType: "collection", entityName: "Products" },
    { userId: riley.id, action: "invited", entityType: "member", entityName: "riley@acme.dev" },
  ];
  for (let i = 0; i < activityRows.length; i++) {
    const a = activityRows[i];
    await prisma.activityLog.create({
      data: { workspaceId: workspace.id, projectId: project.id, userId: a.userId, action: a.action, entityType: a.entityType, entityName: a.entityName, createdAt: new Date(now - i * 3600000) },
    });
  }

  // ── Docs ──
  await prisma.documentation.create({
    data: {
      projectId: project.id,
      title: "E-Commerce API overview",
      slug: "e-commerce-api-overview",
      source: "MANUAL",
      published: true,
      content: `# E-Commerce API\n\nStorefront backend covering authentication, catalog, and orders.\n\n## Base URL\n\n\`\`\`\n{{BASE_URL}}\n\`\`\`\n\nSet per environment under **Environments**. Development points at the public DummyJSON sandbox.\n\n## Authentication\n\n\`POST /auth/login\` returns an \`accessToken\`. Store it in the \`TOKEN\` environment variable, then use **Bearer** auth on protected endpoints like \`GET /auth/me\`.\n\n## Conventions\n\n- List endpoints accept \`limit\`, \`skip\`, and \`select\` parameters.\n- Errors return \`{ "message": "..." }\` with an appropriate status code.`,
    },
  });

  console.log("Seed complete. Demo login: demo@apiforge.dev / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
