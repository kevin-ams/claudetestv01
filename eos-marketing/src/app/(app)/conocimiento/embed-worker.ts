/// <reference lib="webworker" />
// Calcula vectores de significado (embeddings) en un Web Worker para no congelar la pantalla.
// El modelo se descarga una sola vez y queda en la caché del navegador.
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { EMBED_MODEL } from "@/lib/domain/vault-shared";

env.allowLocalModels = false;
env.useBrowserCache = true;

let extractor: Promise<FeatureExtractionPipeline> | null = null;

type Msg = { id: number; type: "load" } | { id: number; type: "embed"; texts: string[] };

function load(id: number) {
  extractor ??= pipeline("feature-extraction", EMBED_MODEL, {
    dtype: "q8",
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status === "progress" && p.total) self.postMessage({ id, type: "progress", file: p.file, loaded: p.loaded, total: p.total });
    },
  }) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const msg = e.data;
  try {
    const ex = await load(msg.id);
    if (msg.type === "load") {
      self.postMessage({ id: msg.id, type: "ready" });
      return;
    }
    const vectors: number[][] = [];
    // De a 8 textos para no usar demasiada memoria.
    for (let i = 0; i < msg.texts.length; i += 8) {
      const out = await ex(msg.texts.slice(i, i + 8), { pooling: "mean", normalize: true });
      vectors.push(...(out.tolist() as number[][]));
    }
    self.postMessage({ id: msg.id, type: "vectors", vectors });
  } catch (err) {
    extractor = null;
    self.postMessage({ id: msg.id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
