export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export type Role = "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  role?: Role;
  memberCount?: number;
  projectCount?: number;
}

export interface Member {
  id: string;
  role: Role;
  user: User;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  role?: Role;
  collections?: Collection[];
  environments?: Environment[];
}

export interface Collection {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  folders?: Folder[];
  requests?: ApiRequest[];
}

export interface Folder {
  id: string;
  collectionId: string;
  parentId?: string | null;
  name: string;
  sortOrder: number;
}

export interface KvRow {
  id?: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface Assertion {
  id?: string;
  type: string;
  target?: string | null;
  operator?: string | null;
  expected?: string | null;
  enabled: boolean;
}

export interface ApiRequest {
  id: string;
  collectionId: string;
  folderId?: string | null;
  name: string;
  method: string;
  url: string;
  bodyType: string;
  body?: string | null;
  authType: string;
  authConfig?: Record<string, unknown> | null;
  sortOrder: number;
  headers: KvRow[];
  params: KvRow[];
  assertions: Assertion[];
  updatedAt?: string;
}

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  enabled: boolean;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  variables: EnvVariable[];
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

export interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  statusCode?: number | null;
  responseTimeMs?: number | null;
  createdAt: string;
  user?: { name: string };
  request?: { id: string; name: string } | null;
}

export interface AssertionResult {
  type: string;
  description: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  actual?: string;
  expected?: string;
}

export interface TestResult {
  id: string;
  requestName: string;
  method: string;
  url: string;
  status: string;
  statusCode?: number | null;
  responseTimeMs?: number | null;
  error?: string | null;
  passed: number;
  failed: number;
  skipped: number;
  assertionLog?: AssertionResult[] | null;
}

export interface TestRun {
  id: string;
  name: string;
  status: string;
  totalRequests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  createdAt: string;
  collection?: { name: string } | null;
  results?: TestResult[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityName?: string | null;
  createdAt: string;
  user: { name: string; avatarUrl?: string | null };
}

export interface Doc {
  id: string;
  title: string;
  slug: string;
  content?: string;
  source: string;
  published: boolean;
  updatedAt: string;
}

export interface Analytics {
  totalRequests: number;
  successful: number;
  failed: number;
  successRate: number;
  avgResponseTime: number;
  testRuns: number;
  requests: number;
  collections: number;
  activeMembers: number;
  daily: { date: string; requests: number; success: number; failed: number; avgTime: number }[];
  statusDistribution: { name: string; value: number }[];
  recentRuns: TestRun[];
}
