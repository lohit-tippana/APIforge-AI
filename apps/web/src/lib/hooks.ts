"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { del, get, patch, post, put } from "./api";
import type { Project, User, Workspace } from "./types";

// ── Auth ──
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await get<{ user: User }>("/auth/me")).user;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => post("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      router.push("/login");
    },
  });
}

// ── Workspaces ──
export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => get<{ workspaces: Workspace[] }>("/workspaces").then((r) => r.workspaces),
  });
}

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => get<{ workspace: Workspace & { members: { id: string; role: string; user: User }[]; projects: Project[] } }>(`/workspaces/${workspaceId}`).then((r) => r.workspace),
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) => post<{ workspace: Workspace }>("/workspaces", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

// ── Projects ──
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => get<{ project: Project }>(`/projects/${projectId}`).then((r) => r.project),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; name: string; description?: string }) =>
      post<{ project: Project }>("/projects", data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["workspace", v.workspaceId] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => del(`/projects/${projectId}`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Collections ──
export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; name: string; description?: string }) =>
      post<{ collection: unknown }>("/collections", data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["project", v.projectId] }),
  });
}

export function useRenameCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name: string }) => patch(`/collections/${data.id}`, { name: data.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project"] }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/collections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project"] }),
  });
}

export function useSaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id?: string; collectionId?: string; folderId?: string | null } & Record<string, unknown>) =>
      data.id ? put(`/requests/${data.id}`, data) : post<{ request: { id: string } }>("/requests", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project"] }),
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/requests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project"] }),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { collectionId: string; name: string; parentId?: string | null }) => post("/folders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project"] }),
  });
}
