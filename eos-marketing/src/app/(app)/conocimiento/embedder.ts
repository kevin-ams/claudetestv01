"use client";

import { useSyncExternalStore } from "react";

// Búsqueda por significado en el navegador: un solo worker por pestaña. Se activa por navegador
// (queda recordado) porque la primera vez descarga el modelo (~135 MB).

export type EmbedderState =
  | { status: "off" }
  | { status: "loading"; percent: number }
  | { status: "ready" }
  | { status: "error"; message: string };

const KEY = "vault-semantic";
let state: EmbedderState = { status: "off" };
const listeners = new Set<() => void>();
const set = (s: EmbedderState) => {
  state = s;
  listeners.forEach((l) => l());
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();
const loaded = new Map<string, { loaded: number; total: number }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./embed-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as { id: number; type: string; vectors?: number[][]; message?: string; file?: string; loaded?: number; total?: number };
    if (m.type === "progress" && m.file && m.total) {
      loaded.set(m.file, { loaded: m.loaded ?? 0, total: m.total });
      const all = [...loaded.values()];
      const percent = Math.round((all.reduce((s, x) => s + x.loaded, 0) / all.reduce((s, x) => s + x.total, 0)) * 100);
      if (state.status === "loading") set({ status: "loading", percent });
      return;
    }
    const p = pending.get(m.id);
    if (m.type === "ready") {
      set({ status: "ready" });
      p?.resolve([]);
    } else if (m.type === "vectors") p?.resolve(m.vectors ?? []);
    else if (m.type === "error") {
      set({ status: "error", message: m.message ?? "Error" });
      p?.reject(new Error(m.message));
    }
    pending.delete(m.id);
  };
  return worker;
}

function call(msg: { type: "load" } | { type: "embed"; texts: string[] }): Promise<number[][]> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, ...msg });
  });
}

export function semanticEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Descarga (la primera vez) y carga el modelo. */
export async function enableSemantic(): Promise<boolean> {
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
  if (state.status === "ready") return true;
  if (state.status !== "loading") set({ status: "loading", percent: 0 });
  try {
    await call({ type: "load" });
    return true;
  } catch {
    return false;
  }
}

export function disableSemantic() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  worker?.terminate();
  worker = null;
  set({ status: "off" });
}

/** e5 espera "query: " en preguntas y "passage: " en textos. */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (state.status !== "ready") return null;
  return (await call({ type: "embed", texts: [`query: ${text}`] }))[0] ?? null;
}

export async function embedPassages(texts: string[]): Promise<number[][]> {
  if (state.status !== "ready") throw new Error("El modelo no está listo");
  return call({ type: "embed", texts: texts.map((t) => `passage: ${t}`) });
}

export function useEmbedder(): EmbedderState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
