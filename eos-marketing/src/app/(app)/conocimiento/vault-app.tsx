"use client";

import { FileText, Magnifier, Plus, TrashBin } from "@gravity-ui/icons";
import { Button, Chip, Input, buttonVariants } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Segmented } from "@/components/ui/segmented";
import { EOS_LABEL, TEMPLATE_FOLDER, buildTree, extractTags, extractWikilinks, folderOf, noteKeys, normalizeKey, type EosEntity, type EosKind, type NoteSummary } from "@/lib/domain/vault-shared";
import type { NoteVersion } from "@/lib/domain/vault";
import { createNoteAction, deleteNoteAction, listNotesAction, listVersionsAction, relatedByMeaningAction, resetEmbeddingsAction, openNoteAction, saveNoteAction, versionContentAction, type OpenNote } from "./actions";
import { MarkdownEditor, type LinkOption } from "./markdown-editor";
import { NotePreview } from "./note-preview";
import { NewNoteDialog, PdfImportDialog } from "./vault-dialogs";
import { SearchDialog } from "./search-dialog";
import { GraphPanel, LocalGraph, type GraphActions } from "./graph-panel";
import { ConnectClaudeDialog } from "./connect-claude";
import { disableSemantic, enableSemantic, semanticEnabled, useEmbedder } from "./embedder";
import { STALE } from "@/lib/client-actions";
import { FolderNode } from "./folder-tree";
import { useAutosave, useBackgroundIndexer, useUnsavedWarning, useVaultShortcuts } from "./vault-hooks";

type Status = "saved" | "dirty" | "saving" | "error" | "conflict";
type Draft = { title: string; folder: string; content: string };
const WHEN = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function VaultApp({
  initialNotes,
  entities,
  canEdit,
  consultantUrl,
}: {
  initialNotes: NoteSummary[];
  entities: EosEntity[];
  canEdit: boolean;
  consultantUrl: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [notes, setNotes] = useState(initialNotes);
  const [current, setCurrent] = useState<OpenNote | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<Status>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ content: string; title: string; by: string | null; version: number } | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">(canEdit ? "edit" : "preview");
  const [view, setView] = useState<"notes" | "graph">(() => (params.get("vista") === "grafo" ? "graph" : "notes"));
  const [filter, setFilter] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<null | { kind: "new"; title?: string } | { kind: "pdf" } | { kind: "switch" } | { kind: "delete" } | { kind: "claude" }>(null);
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [viewing, setViewing] = useState<{ v: NoteVersion; content: string } | null>(null);
  const [loading, startLoad] = useTransition();
  const saving = useRef(false);
  const embedder = useEmbedder();
  const { indexing, reindex } = useBackgroundIndexer(embedder.status === "ready" && canEdit);
  const [related, setRelated] = useState<{ id: number; title: string; score: number }[] | null>(null);

  const activeId = current?.note.id ?? null;
  const folders = useMemo(() => [...new Set(notes.map((n) => folderOf(n.path)).filter(Boolean))].sort(), [notes]);
  const templates = useMemo(() => notes.filter((n) => n.path.startsWith(`${TEMPLATE_FOLDER}/`)), [notes]);
  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, "es")), [notes]);
  const byKey = useMemo(() => {
    const m = new Map<string, NoteSummary>();
    for (const n of notes) for (const k of noteKeys(n)) if (!m.has(k)) m.set(k, n);
    return m;
  }, [notes]);
  const exists = useCallback((target: string) => byKey.has(normalizeKey(target)), [byKey]);
  const entity = useCallback(
    (kind: EosKind, ref: string): EosEntity | null => {
      const id = /^#?(\d+)$/.exec(ref.trim());
      if (id) return entities.find((e) => e.kind === kind && e.id === Number(id[1])) ?? null;
      const k = normalizeKey(ref);
      return entities.find((e) => e.kind === kind && normalizeKey(e.title) === k) ?? null;
    },
    [entities],
  );
  const options: LinkOption[] = useMemo(
    () => [
      ...notes.filter((n) => n.id !== activeId).map((n) => ({ label: n.title, detail: folderOf(n.path) || undefined })),
      ...entities.map((e) => ({ label: `${e.kind}:${e.title}`, detail: `${EOS_LABEL[e.kind]} · ${e.team}`, apply: `${e.kind}:${e.id}|${e.title}` })),
    ],
    [notes, entities, activeId],
  );

  const refreshList = useCallback(async () => {
    const list = await listNotesAction().catch(() => null);
    if (list) setNotes(list);
  }, []);

  const openNote = useCallback(
    (id: number, push = true) =>
      startLoad(async () => {
        const r = await openNoteAction(id).catch(() => null);
        if (!r) {
          setMessage("No se encontró la nota.");
          return;
        }
        setCurrent(r);
        setDraft({ title: r.note.title, folder: folderOf(r.note.path), content: r.note.content });
        setVersion(r.note.version);
        setStatus("saved");
        setConflict(null);
        setVersions(null);
        setMessage(null);
        // Abre las carpetas de la nota en el árbol.
        const parts = folderOf(r.note.path).split("/").filter(Boolean);
        setOpenFolders((s) => new Set([...s, ...parts.map((_, i) => parts.slice(0, i + 1).join("/"))]));
        if (push) router.replace(`/conocimiento?nota=${id}`, { scroll: false });
      }),
    [router],
  );

  // Abre la nota del enlace (?nota=) al entrar.
  // ?nota=<id> abre esa nota; ?abrir=<título o ruta> la busca por nombre (enlaces del Asistente IA).
  const initial = useRef(params.get("nota"));
  const byName = useRef(params.get("abrir"));
  useEffect(() => {
    if (initial.current) {
      openNote(Number(initial.current), false);
      initial.current = null;
    } else if (byName.current) {
      const hit = byKey.get(normalizeKey(byName.current));
      if (hit) openNote(hit.id);
      else setFilter(byName.current);
      byName.current = null;
    }
  }, [openNote, byKey]);

  const save = useCallback(
    async (force = false) => {
      if (!current || !draft || saving.current || !canEdit) return;
      saving.current = true;
      setStatus("saving");
      const r = await saveNoteAction({ id: current.note.id, title: draft.title, folder: draft.folder, content: draft.content, baseVersion: version, force }).catch(() => ({
        ok: false as const,
        conflict: false as const,
        message: STALE,
      }));
      saving.current = false;
      if (r.ok) {
        setVersion(r.version);
        setStatus((s) => (s === "saving" ? "saved" : s));
        setConflict(null);
        if (r.path !== current.note.path || draft.title !== current.note.title) {
          setCurrent((c) => (c ? { ...c, note: { ...c.note, path: r.path, title: draft.title, version: r.version } } : c));
        }
        // La lista (tags, enlaces, títulos) se actualiza después de cada guardado; luego se reindexa.
        refreshList();
        reindex();
        if (r.renamed) setMessage(`Se actualizaron los enlaces en ${r.renamed} nota(s).`);
      } else if (r.conflict) {
        setStatus("conflict");
        setConflict({ content: r.server.content, title: r.server.title, by: r.server.updated_by_name, version: r.server.version });
      } else {
        setStatus("error");
        setMessage(r.message);
      }
    },
    [current, draft, version, canEdit, refreshList, reindex],
  );

  // Búsqueda por significado: si ya se activó en este navegador, el modelo se carga (desde la caché).
  useEffect(() => {
    if (semanticEnabled()) enableSemantic();
  }, []);


  // Notas relacionadas por significado (con los vectores ya guardados; no necesita el modelo).
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    relatedByMeaningAction(activeId)
      .then((r) => alive && setRelated(r))
      .catch(() => alive && setRelated([]));
    return () => {
      alive = false;
    };
  }, [activeId, indexing]);

  useAutosave(status === "dirty", draft, save);
  useUnsavedWarning(status === "dirty" || status === "saving");
  useVaultShortcuts({ onSearch: () => setDialog({ kind: "switch" }), onSave: () => save() });

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    if (status !== "conflict") setStatus("dirty");
  };

  const create = async (input: { title: string; folder: string; templateId?: number | null; content?: string }) => {
    const r = await createNoteAction(input).catch(() => ({ ok: false, message: STALE, id: undefined }));
    if (!r.ok || !r.id) return r.message;
    setDialog(null);
    await refreshList();
    openNote(r.id);
    reindex();
    return null;
  };

  const openTarget = (target: string) => {
    const hit = byKey.get(normalizeKey(target));
    if (hit) openNote(hit.id);
    else if (canEdit) setDialog({ kind: "new", title: target });
  };

  const onPreviewLink = (href: string) => {
    const [, kind, rest] = /^#(wl|wlx|eos):(.*)$/.exec(href) ?? [];
    if (kind === "eos") {
      const [k, ref] = [rest.split(":")[0], decodeURIComponent(rest.split(":").slice(1).join(":"))];
      const e = entity(k as EosKind, ref);
      if (e) router.push(e.href);
      return;
    }
    openTarget(decodeURIComponent(rest));
  };

  const graphActions: GraphActions = {
    onOpen: (id) => {
      setView("notes");
      openNote(id);
    },
    onCreate: (title) => (canEdit ? setDialog({ kind: "new", title }) : setMessage(`La nota “${title}” todavía no existe.`)),
    onEntity: (href) => router.push(href),
    onTag: (t) => {
      setView("notes");
      setTag(t);
    },
  };

  const visible = useMemo(() => {
    const k = normalizeKey(filter);
    return notes.filter((n) => (!tag || n.tags.includes(tag)) && (!k || normalizeKey(`${n.title} ${n.path}`).includes(k)));
  }, [notes, filter, tag]);
  const tree = useMemo(() => buildTree(visible), [visible]);
  const treeOpen = filter || tag ? new Set(folders) : openFolders;

  // Panel derecho: enlaces salientes, tags y entidades EOS de lo que se está escribiendo.
  const links = useMemo(() => (draft ? extractWikilinks(draft.content) : []), [draft]);
  const outgoing = [...new Map(links.filter((l) => l.kind === "note").map((l) => [normalizeKey(l.target), l.target])).values()];
  const eosLinks = links.filter((l) => l.kind !== "note");
  const tags = useMemo(() => (draft ? extractTags(draft.content) : []), [draft]);

  const statusLabel: Record<Status, string> = {
    saved: "Guardado",
    dirty: "Cambios sin guardar…",
    saving: "Guardando…",
    error: "No se guardó",
    conflict: "Conflicto de versiones",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Conocimiento</h1>
        <Chip size="sm" variant="soft" color="warning">
          Premium
        </Chip>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted" role="status" aria-label="Búsqueda por significado">
          {embedder.status === "off" && (
            <Button size="sm" variant="ghost" className="text-primary" onPress={() => enableSemantic()}>
              Activar búsqueda por significado
            </Button>
          )}
          {embedder.status === "loading" && <span>Descargando modelo de significado… {embedder.percent}% (solo la primera vez, ~135 MB)</span>}
          {embedder.status === "error" && (
            <>
              <span className="text-red">No se pudo cargar el modelo de significado.</span>
              <Button size="sm" variant="ghost" className="text-primary" onPress={() => enableSemantic()}>
                Reintentar
              </Button>
            </>
          )}
          {embedder.status === "ready" && (
            <>
              <Chip size="sm" variant="soft" color="success">
                Significado activo
              </Chip>
              {indexing && <span>Indexando {indexing.done + 1} de {indexing.total}…</span>}
              {canEdit && !indexing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-primary"
                  onPress={async () => {
                    const r = await resetEmbeddingsAction().catch(() => ({ ok: false, message: STALE }));
                    setMessage(r.message);
                    reindex();
                  }}
                >
                  Reindexar vault
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted" onPress={() => disableSemantic()}>
                Desactivar
              </Button>
            </>
          )}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Segmented
            aria-label="Vista del vault"
            size="md"
            options={[
              { id: "notes" as const, label: "Notas" },
              { id: "graph" as const, label: "Grafo" },
            ]}
            value={view}
            onChange={setView}
          />
          {consultantUrl && (
            <a href={consultantUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
              Preguntar a la IA (Claude)
            </a>
          )}
          <Button variant="outline" onPress={() => setDialog({ kind: "claude" })}>
            Conectar con Claude
          </Button>
          <Button variant="outline" onPress={() => setDialog({ kind: "switch" })}>
            <Magnifier aria-hidden /> Buscar <kbd className="ml-1 hidden rounded border border-border px-1 text-[10px] text-muted sm:inline">Ctrl K</kbd>
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onPress={() => setDialog({ kind: "pdf" })}>
                <FileText aria-hidden /> PDF a nota
              </Button>
              <Button variant="primary" onPress={() => setDialog({ kind: "new" })}>
                <Plus aria-hidden /> Nueva nota
              </Button>
            </>
          )}
        </div>
      </div>

      {view === "graph" ? (
        <GraphPanel notes={notes} entities={entities} actions={graphActions} />
      ) : (
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* Izquierda: carpetas y notas */}
        <aside className="card card--default flex max-h-[80vh] flex-col gap-2 overflow-hidden p-3 lg:sticky lg:top-20">
          <Input aria-label="Filtrar notas" placeholder="Filtrar por título…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {allTags.length > 0 && (
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? null : t)}
                  aria-pressed={tag === t}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${tag === t ? "bg-primary text-primary-foreground" : "bg-default text-muted hover:text-foreground"}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
          <nav aria-label="Notas del vault" className="min-h-0 flex-1 overflow-y-auto">
            <FolderNode
              folder={tree}
              depth={0}
              activeId={activeId}
              open={treeOpen}
              toggle={(p) => setOpenFolders((s) => (s.has(p) ? new Set([...s].filter((x) => x !== p)) : new Set([...s, p])))}
              onOpen={(id) => openNote(id)}
            />
            {visible.length === 0 && <p className="px-1 py-2 text-sm text-muted">No hay notas con ese filtro.</p>}
          </nav>
          <p className="text-[11px] text-muted">{notes.length} nota(s)</p>
        </aside>

        {/* Centro: editor */}
        <section className={`card card--default flex min-h-[70vh] min-w-0 flex-col gap-2 p-4 ${loading ? "opacity-60" : ""}`}>
          {!current || !draft ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
              <p className="text-base font-medium text-foreground">El cerebro de la organización</p>
              <p>Elige una nota a la izquierda, búscala con Ctrl/Cmd+K o crea una nueva.</p>
              <p>
                Enlaza notas con <code>[[Título]]</code> y rocks, issues o KPIs con <code>[[rock:…]]</code>, <code>[[issue:…]]</code>,{" "}
                <code>[[kpi:…]]</code>. Agrega temas con <code>#tags</code>.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Título de la nota"
                  value={draft.title}
                  readOnly={!canEdit}
                  onChange={(e) => edit({ title: e.target.value })}
                  className="min-w-48 flex-1 text-lg font-semibold"
                />
                <Input
                  aria-label="Carpeta"
                  placeholder="(raíz)"
                  value={draft.folder}
                  readOnly={!canEdit}
                  onChange={(e) => edit({ folder: e.target.value })}
                  list="vault-folders-edit"
                  className="w-44"
                />
                <datalist id="vault-folders-edit">
                  {folders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Segmented
                  aria-label="Modo"
                  options={[
                    ...(canEdit ? [{ id: "edit" as const, label: "Editar" }] : []),
                    { id: "preview" as const, label: "Vista previa" },
                  ]}
                  value={mode}
                  onChange={setMode}
                />
                {canEdit && (
                  <span
                    role="status"
                    className={status === "saved" ? "text-green" : status === "error" || status === "conflict" ? "text-red" : "text-muted"}
                  >
                    {statusLabel[status]}
                  </span>
                )}
                <span className="text-muted">
                  · {current.note.path} · editada {WHEN.format(new Date(current.note.updated_at))}
                  {current.note.updated_by_name ? ` por ${current.note.updated_by_name}` : ""}
                </span>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="ml-auto text-red" onPress={() => setDialog({ kind: "delete" })} aria-label="Eliminar nota">
                    <TrashBin aria-hidden />
                  </Button>
                )}
              </div>
              {message && <p className="rounded-lg bg-default px-3 py-1.5 text-xs">{message}</p>}
              {conflict && (
                <div className="flex flex-col gap-2 rounded-lg border border-red/40 bg-red-bg px-3 py-2 text-sm text-red" role="alert">
                  <p>
                    {conflict.by ?? "Otra persona"} guardó una versión más nueva de esta nota mientras editabas. Tus cambios no se han guardado.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setDraft((d) => (d ? { ...d, title: conflict.title, content: conflict.content } : d));
                        setVersion(conflict.version);
                        setConflict(null);
                        setStatus("saved");
                      }}
                    >
                      Usar la versión guardada (descartar la mía)
                    </Button>
                    <Button size="sm" variant="danger" onPress={() => save(true)}>
                      Guardar la mía encima
                    </Button>
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1">
                {mode === "edit" && canEdit ? (
                  <MarkdownEditor
                    key={current.note.id}
                    value={draft.content}
                    onChange={(content) => edit({ content })}
                    options={options}
                    onOpenLink={openTarget}
                    onSave={() => save()}
                  />
                ) : (
                  <NotePreview content={draft.content} exists={exists} entity={entity} onLink={onPreviewLink} />
                )}
              </div>
              {mode === "edit" && canEdit && (
                <p className="text-[11px] text-muted">Ctrl/Cmd+clic en un [[enlace]] para abrirlo · Ctrl/Cmd+S guarda · se guarda solo al dejar de escribir.</p>
              )}
            </>
          )}
        </section>

        {/* Derecha: conexiones de la nota */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[80vh] lg:overflow-y-auto">
          {current && draft && (
            <>
              <section className="card card--default flex flex-col gap-1 p-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Enlaces entrantes ({current.backlinks.length})</h2>
                {current.backlinks.length === 0 ? (
                  <p className="text-xs text-muted">Ninguna nota enlaza aquí todavía.</p>
                ) : (
                  current.backlinks.map((b) => (
                    <button key={b.id} type="button" className="truncate text-left text-sm text-primary hover:underline" onClick={() => openNote(b.id)}>
                      {b.title}
                    </button>
                  ))
                )}
              </section>
              <section className="card card--default flex flex-col gap-1 p-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Enlaces salientes ({outgoing.length})</h2>
                {outgoing.length === 0 && <p className="text-xs text-muted">Escribe [[ para enlazar otra nota.</p>}
                {outgoing.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`truncate text-left text-sm hover:underline ${exists(t) ? "text-primary" : "text-muted italic"}`}
                    onClick={() => openTarget(t)}
                    title={exists(t) ? `Abrir ${t}` : "No existe: clic para crearla"}
                  >
                    {t}
                    {!exists(t) && " (crear)"}
                  </button>
                ))}
              </section>
              <LocalGraph notes={notes} entities={entities} noteId={current.note.id} actions={graphActions} />
              <section className="card card--default flex flex-col gap-1 p-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Notas relacionadas (significado)</h2>
                {related === null ? (
                  <p className="text-xs text-muted">Calculando…</p>
                ) : related.length === 0 ? (
                  <p className="text-xs text-muted">
                    {embedder.status === "ready" ? "Todavía no hay notas parecidas (o esta nota aún no se indexa)." : "Activa la búsqueda por significado para calcularlas."}
                  </p>
                ) : (
                  related.map((r) => (
                    <button key={r.id} type="button" className="flex justify-between gap-2 text-left text-sm hover:underline" onClick={() => openNote(r.id)}>
                      <span className="truncate text-primary">{r.title}</span>
                      <span className="shrink-0 text-xs text-muted">{Math.round(r.score * 100)}%</span>
                    </button>
                  ))
                )}
              </section>
              {eosLinks.length > 0 && (
                <section className="card card--default flex flex-col gap-1 p-3">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-muted">EOS vinculado</h2>
                  {eosLinks.map((l, i) => {
                    const e = entity(l.kind as EosKind, l.ref);
                    return (
                      <button
                        key={`${l.raw}-${i}`}
                        type="button"
                        disabled={!e}
                        onClick={() => e && router.push(e.href)}
                        className="flex items-center gap-1.5 text-left text-sm disabled:opacity-60"
                      >
                        <Chip size="sm" variant="soft" color="success">
                          {EOS_LABEL[l.kind as EosKind]}
                        </Chip>
                        <span className="truncate">{e ? `${e.title} · ${e.team}` : `${l.ref} (no encontrado)`}</span>
                      </button>
                    );
                  })}
                </section>
              )}
              <section className="card card--default flex flex-col gap-1 p-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Tags</h2>
                {tags.length === 0 ? (
                  <p className="text-xs text-muted">Sin tags. Escribe #tema en la nota.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <button key={t} type="button" className="rounded-full bg-default px-2 py-0.5 text-[11px] hover:text-primary" onClick={() => setTag(t)}>
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </section>
              <section className="card card--default flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Historial</h2>
                  {versions === null && (
                    <Button size="sm" variant="ghost" className="text-xs text-primary" onPress={async () => setVersions(await listVersionsAction(current.note.id).catch(() => []))}>
                      Ver versiones
                    </Button>
                  )}
                </div>
                {versions?.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="flex justify-between gap-2 text-left text-xs hover:text-primary"
                    onClick={async () => {
                      const content = await versionContentAction(current.note.id, v.id).catch(() => null);
                      if (content !== null) setViewing({ v, content });
                    }}
                  >
                    <span>{WHEN.format(new Date(v.updated_at))}</span>
                    <span className="truncate text-muted">{v.updated_by_name ?? "—"}</span>
                  </button>
                ))}
                {versions?.length === 0 && <p className="text-xs text-muted">Sin versiones anteriores.</p>}
              </section>
            </>
          )}
        </aside>
      </div>

      )}

      {viewing && current && (
        <ConfirmDialog
          title={`Versión del ${WHEN.format(new Date(viewing.v.updated_at))}`}
          confirmLabel={canEdit ? "Restaurar esta versión" : "Cerrar"}
          cancelLabel="Cerrar"
          onConfirm={() => {
            if (canEdit) {
              edit({ content: viewing.content });
              setMode("edit");
            }
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
        >
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs text-foreground">{viewing.content}</pre>
          <p className="mt-2">Al restaurar, el contenido reemplaza al actual y se guarda como una versión nueva (la actual queda en el historial).</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === "new" && (
        <NewNoteDialog
          folders={folders}
          templates={templates}
          defaultFolder={draft?.folder && draft.folder !== TEMPLATE_FOLDER ? draft.folder : ""}
          defaultTitle={dialog.title}
          onCreate={create}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "claude" && <ConnectClaudeDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "pdf" && <PdfImportDialog folders={folders} defaultFolder={draft?.folder ?? ""} onCreate={create} onClose={() => setDialog(null)} />}
      {dialog?.kind === "switch" && (
        <SearchDialog
          notes={notes}
          onOpen={(id) => {
            setDialog(null);
            openNote(id);
          }}
          onCreate={canEdit ? (title) => setDialog({ kind: "new", title }) : null}
          onEnableSemantic={() => enableSemantic()}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && current && (
        <ConfirmDialog
          title="¿Eliminar esta nota?"
          confirmLabel="Sí, eliminar"
          danger
          onConfirm={async () => {
            const r = await deleteNoteAction(current.note.id).catch(() => ({ ok: false, message: STALE }));
            setDialog(null);
            if (!r.ok) return setMessage(r.message);
            setCurrent(null);
            setDraft(null);
            router.replace("/conocimiento", { scroll: false });
            refreshList();
          }}
          onClose={() => setDialog(null)}
        >
          “{current.note.title}” se borra con su historial. Los [[enlaces]] que apuntan a ella quedarán como notas por crear.
        </ConfirmDialog>
      )}
    </div>
  );
}
