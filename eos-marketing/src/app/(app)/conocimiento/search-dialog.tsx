"use client";

import { Button, Chip, Input, Modal } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeKey, reciprocalRankFusion, type MeaningHit, type NoteSummary, type TextHit } from "@/lib/domain/vault-shared";
import { meaningSearchAction, textSearchAction } from "./actions";
import { embedQuery, useEmbedder } from "./embedder";

type Row = {
  id: number;
  title: string;
  path: string;
  snippet: string;
  byTitle: boolean;
  byWords: boolean;
  meaning: number | null;
};

/** Distancia de edición (para tolerar errores de dedo en títulos). */
function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

function titleMatches(notes: NoteSummary[], q: string): NoteSummary[] {
  const k = normalizeKey(q);
  if (!k) return notes.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
  const words = k.split(" ").filter(Boolean);
  const scored = notes
    .map((n) => {
      const t = normalizeKey(n.title);
      if (t.startsWith(k)) return { n, s: 4 };
      if (t.includes(k)) return { n, s: 3 };
      if (normalizeKey(n.path).includes(k) || n.tags.some((g) => g.includes(k))) return { n, s: 2 };
      // Errores de dedo: cada palabra buscada parecida a alguna del título.
      const tw = t.split(/[^a-z0-9ñ]+/).filter(Boolean);
      const fuzzy = words.every((w) => w.length >= 4 && tw.some((x) => lev(w, x) <= (w.length >= 7 ? 2 : 1)));
      return { n, s: fuzzy ? 1 : 0 };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.n.title.localeCompare(b.n.title, "es"));
  return scored.slice(0, 8).map((x) => x.n);
}

/** Buscador del vault (Ctrl/Cmd+K): títulos al instante, contenido por palabras y, si está activa, por significado. */
export function SearchDialog({
  notes,
  onOpen,
  onCreate,
  onEnableSemantic,
  onClose,
}: {
  notes: NoteSummary[];
  onOpen: (id: number) => void;
  onCreate: ((title: string) => void) | null;
  onEnableSemantic: () => void;
  onClose: () => void;
}) {
  const embedder = useEmbedder();
  const [q, setQ] = useState("");
  const [words, setWords] = useState<TextHit[]>([]);
  const [meaning, setMeaning] = useState<MeaningHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    const id = ++seq.current;
    if (query.length < 2) return;
    const t = setTimeout(async () => {
      setBusy(true);
      const [w, m] = await Promise.all([
        textSearchAction(query).catch(() => [] as TextHit[]),
        embedder.status === "ready"
          ? embedQuery(query)
              .then((v) => (v ? meaningSearchAction(v) : []))
              .catch(() => [] as MeaningHit[])
          : Promise.resolve([] as MeaningHit[]),
      ]);
      if (id !== seq.current) return;
      setWords(w);
      setMeaning(m);
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, embedder.status]);

  const titles = useMemo(() => titleMatches(notes, q), [notes, q]);
  // Con menos de 2 letras solo se muestran títulos (los resultados anteriores se ignoran).
  const active = q.trim().length >= 2;
  const rows: Row[] = useMemo(() => {
    // Búsqueda híbrida: los tres rankings se combinan con Reciprocal Rank Fusion.
    const w = active ? words : [];
    const m = active ? meaning : [];
    const fused = reciprocalRankFusion([titles.map((n) => n.id), w.map((h) => h.id), m.map((h) => h.id)]);
    const byId = new Map<number, Row>();
    for (const n of titles) byId.set(n.id, { id: n.id, title: n.title, path: n.path, snippet: "", byTitle: true, byWords: false, meaning: null });
    for (const h of w) {
      const r = byId.get(h.id) ?? { id: h.id, title: h.title, path: h.path, snippet: "", byTitle: false, byWords: false, meaning: null };
      byId.set(h.id, { ...r, byWords: true, snippet: h.snippet });
    }
    for (const h of m) {
      const r = byId.get(h.id) ?? { id: h.id, title: h.title, path: h.path, snippet: "", byTitle: false, byWords: false, meaning: null };
      byId.set(h.id, { ...r, meaning: h.score, snippet: r.snippet || h.snippet });
    }
    return [...byId.values()].sort((a, b) => (fused.get(b.id) ?? 0) - (fused.get(a.id) ?? 0)).slice(0, 25);
  }, [titles, words, meaning, active]);

  const box = useRef<HTMLUListElement>(null);
  useEffect(() => {
    box.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Buscar en el vault" className="sm:max-w-2xl">
          <Modal.CloseTrigger />
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Buscar en el vault</h2>
            <Input
              aria-label="Buscar"
              placeholder="Título, palabras o una pregunta (“cómo damos de alta a un estudiante”)"
              value={q}
              autoFocus
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSel((s) => Math.min(s + 1, rows.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSel((s) => Math.max(s - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (rows[sel]) onOpen(rows[sel].id);
                  else if (q.trim() && onCreate) onCreate(q.trim());
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {embedder.status === "ready" ? (
                <span>Buscando por título, palabras y significado.</span>
              ) : embedder.status === "loading" ? (
                <span>Descargando el modelo de significado… {embedder.percent}% (mientras tanto, por título y palabras).</span>
              ) : (
                <>
                  <span>Buscando por título y palabras.</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary" onPress={onEnableSemantic}>
                    Activar búsqueda por significado
                  </Button>
                </>
              )}
              {busy && <span>· buscando…</span>}
            </div>
            <ul ref={box} role="listbox" aria-label="Resultados" className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => onOpen(r.id)}
                  className={`cursor-pointer rounded-lg border px-3 py-2 ${i === sel ? "border-primary bg-primary/5" : "border-transparent hover:bg-default"}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-muted">{r.path}</span>
                    <span className="ml-auto flex gap-1">
                      {r.byTitle && (
                        <Chip size="sm" variant="soft">
                          título
                        </Chip>
                      )}
                      {r.byWords && (
                        <Chip size="sm" variant="soft" color="accent">
                          palabras
                        </Chip>
                      )}
                      {r.meaning !== null && (
                        <Chip size="sm" variant="soft" color="success" title="Similitud por significado">
                          significado {Math.round(r.meaning * 100)}%
                        </Chip>
                      )}
                    </span>
                  </div>
                  {r.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.snippet}</p>}
                </li>
              ))}
              {rows.length === 0 && q.trim().length >= 2 && !busy && (
                <li className="px-1 py-2 text-sm text-muted">
                  Sin resultados.{" "}
                  {onCreate && (
                    <Button size="sm" variant="ghost" className="text-primary" onPress={() => onCreate(q.trim())}>
                      + Crear la nota “{q.trim()}”
                    </Button>
                  )}
                </li>
              )}
            </ul>
            <p className="text-xs text-muted">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
