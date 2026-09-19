import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "../config";
import { verifyAccessToken } from "./jwt";

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: config.webOrigin, credentials: true },
    path: "/api/socket.io",
  });

  io.use((socket, next) => {
    try {
      // Browser clients authenticate via the httpOnly access cookie —
      // same-site so it's sent on the WS handshake.
      const cookieHeader = socket.handshake.headers.cookie ?? "";
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${config.cookies.access}=([^;]+)`));
      const token = match?.[1] ?? (socket.handshake.auth as { token?: string }).token;
      if (!token) return next(new Error("unauthorized"));
      verifyAccessToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:project", (projectId: string) => {
      if (typeof projectId === "string" && projectId.length < 64) socket.join(`project:${projectId}`);
    });
    socket.on("unsubscribe:project", (projectId: string) => socket.leave(`project:${projectId}`));
  });

  return io;
}

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload);
}
