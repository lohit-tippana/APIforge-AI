import "dotenv/config";

const env = (key: string, fallback = ""): string => process.env[key] ?? fallback;

const isProd = process.env.NODE_ENV === "production";

export const config = {
  isProd,
  port: Number(env("PORT", "4100")),
  webOrigin: env("WEB_ORIGIN", "http://localhost:3100"),
  databaseUrl: env("DATABASE_URL"),
  jwt: {
    accessSecret: env("JWT_ACCESS_SECRET", "dev-access-secret-do-not-use-in-prod"),
    refreshSecret: env("JWT_REFRESH_SECRET", "dev-refresh-secret-do-not-use-in-prod"),
    accessTtl: Number(env("ACCESS_TOKEN_TTL", "900")),
    refreshTtl: Number(env("REFRESH_TOKEN_TTL", "604800")),
  },
  redisUrl: env("REDIS_URL"),
  ai: {
    provider: env("AI_PROVIDER", "local"), // "openai" | "local"
    openaiKey: env("OPENAI_API_KEY"),
    openaiBaseUrl: env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),
  },
  cookies: {
    access: "af_access",
    refresh: "af_refresh",
    secure: isProd,
  },
  executor: {
    timeoutMs: Number(env("EXECUTOR_TIMEOUT_MS", "30000")),
    maxResponseBytes: Number(env("EXECUTOR_MAX_BYTES", String(10 * 1024 * 1024))),
  },
};

if (isProd && config.jwt.accessSecret.startsWith("dev-")) {
  throw new Error("JWT secrets must be configured in production");
}
