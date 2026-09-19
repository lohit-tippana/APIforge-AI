"use client";

import { create } from "zustand";
import type { Assertion, ExecutedResponse, KvRow } from "./types";

// Request-builder draft state — the centerpiece store.
interface RequestDraft {
  requestId: string | null; // null = unsaved scratch request
  collectionId: string | null;
  name: string;
  method: string;
  url: string;
  params: KvRow[];
  headers: KvRow[];
  bodyType: string;
  body: string;
  authType: string;
  authConfig: Record<string, unknown>;
  assertions: Assertion[];
  dirty: boolean;
}

interface WorkspaceState {
  activeEnvironmentId: string | null;
  setActiveEnvironment: (id: string | null) => void;

  draft: RequestDraft;
  response: ExecutedResponse | null;
  sending: boolean;
  sendError: string | null;

  loadRequest: (r: Partial<RequestDraft> & { requestId: string | null; collectionId: string | null }) => void;
  patchDraft: (p: Partial<RequestDraft>) => void;
  newRequest: (collectionId?: string | null) => void;
  setResponse: (r: ExecutedResponse | null) => void;
  setSending: (v: boolean) => void;
  setSendError: (e: string | null) => void;
}

const emptyDraft: RequestDraft = {
  requestId: null,
  collectionId: null,
  name: "Untitled request",
  method: "GET",
  url: "",
  params: [{ key: "", value: "", enabled: true }],
  headers: [{ key: "", value: "", enabled: true }],
  bodyType: "NONE",
  body: "",
  authType: "NONE",
  authConfig: {},
  assertions: [],
  dirty: false,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeEnvironmentId: null,
  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  draft: emptyDraft,
  response: null,
  sending: false,
  sendError: null,

  loadRequest: (r) =>
    set({
      draft: {
        ...emptyDraft,
        ...r,
        params: r.params?.length ? r.params : [{ key: "", value: "", enabled: true }],
        headers: r.headers?.length ? r.headers : [{ key: "", value: "", enabled: true }],
        authConfig: r.authConfig ?? {},
        assertions: r.assertions ?? [],
        dirty: false,
      },
      sendError: null,
    }),
  patchDraft: (p) => set((s) => ({ draft: { ...s.draft, ...p, dirty: true } })),
  newRequest: (collectionId = null) =>
    set({ draft: { ...emptyDraft, collectionId }, response: null, sendError: null }),
  setResponse: (r) => set({ response: r }),
  setSending: (v) => set({ sending: v }),
  setSendError: (e) => set({ sendError: e }),
}));
