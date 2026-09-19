"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

let socket: Socket | null = null;

async function ensureSocket(): Promise<Socket> {
  if (socket) return socket;
  // httpOnly cookies can't be read by JS — get a token for the WS handshake.
  const { token } = await fetch("/api/auth/socket-token", { credentials: "same-origin" }).then((r) => r.json());
  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4100", {
    path: "/api/socket.io",
    withCredentials: true,
    auth: { token },
  });
  return socket;
}

export function useProjectSocket(projectId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;
    let cancelled = false;
    const onComplete = (d: { runId: string; status: string }) => {
      qc.invalidateQueries({ queryKey: ["test-runs", projectId] });
      toast[d.status === "FAILED" ? "error" : "success"](`Test run ${d.status.toLowerCase()}`);
    };
    void ensureSocket()
      .then((s) => {
        if (cancelled) return;
        s.emit("subscribe:project", projectId);
        s.on("test-run:complete", onComplete);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      socket?.emit("unsubscribe:project", projectId);
      socket?.off("test-run:complete", onComplete);
    };
  }, [projectId, qc]);
}
