"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

let socket: Socket | null = null;

export function useProjectSocket(projectId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4100", {
        path: "/api/socket.io",
        withCredentials: true,
      });
    }
    socket.emit("subscribe:project", projectId);
    const onComplete = (d: { runId: string; status: string }) => {
      qc.invalidateQueries({ queryKey: ["test-runs", projectId] });
      toast[d.status === "FAILED" ? "error" : "success"](`Test run ${d.status.toLowerCase()}`);
    };
    socket.on("test-run:complete", onComplete);
    return () => {
      socket?.emit("unsubscribe:project", projectId);
      socket?.off("test-run:complete", onComplete);
    };
  }, [projectId, qc]);
}
