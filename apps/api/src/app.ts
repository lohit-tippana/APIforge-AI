import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler } from "./lib/errors";
import { csrfGuard } from "./middleware/auth";
import { authRouter } from "./modules/auth/routes";
import { workspacesRouter } from "./modules/workspaces/routes";
import { projectsRouter } from "./modules/projects/routes";
import { collectionsRouter } from "./modules/collections/routes";
import { environmentsRouter } from "./modules/environments/routes";
import { executeRouter } from "./modules/execute/routes";
import { testsRouter } from "./modules/tests/routes";
import { aiRouter } from "./modules/ai/routes";
import { teamRouter } from "./modules/team/routes";
import { notificationsRouter } from "./modules/notifications/routes";
import { activityRouter } from "./modules/activity/routes";
import { docsRouter } from "./modules/docs/routes";
import { analyticsRouter } from "./modules/analytics/routes";
import { searchRouter } from "./modules/search/routes";
import { usersRouter } from "./modules/users/routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  const authLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api", csrfGuard);

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "apiforge-api" }));

  app.use("/api/auth", authRouter);
  app.use("/api/workspaces", workspacesRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api", collectionsRouter);
  app.use("/api/environments", environmentsRouter);
  app.use("/api/execute", executeRouter);
  app.use("/api", testsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api", teamRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api", activityRouter);
  app.use("/api", docsRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", searchRouter);
  app.use("/api/users", usersRouter);

  app.use("/api", (_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  app.use(errorHandler);

  return app;
}
