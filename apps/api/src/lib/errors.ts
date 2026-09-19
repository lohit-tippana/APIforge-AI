import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") => new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Insufficient permissions") => new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Resource not found") => new ApiError(404, "NOT_FOUND", msg);
export const conflict = (msg: string) => new ApiError(409, "CONFLICT", msg);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("[api] database unreachable:", err.message?.slice(0, 300));
    return res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable — database connection failed" } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "A record with this value already exists" } });
    }
    console.error("[api] prisma error", err.code, err.message?.slice(0, 300));
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
  console.error("[api] unhandled error:", err);
  return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
