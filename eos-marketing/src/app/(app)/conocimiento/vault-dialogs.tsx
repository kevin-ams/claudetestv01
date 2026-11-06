"use client";

import { Button, Input, Modal, TextArea } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppSelect } from "@/components/ui/select";
import { TEMPLATE_FOLDER, normalizeKey, type NoteSummary } from "@/lib/domain/vault-shared";
import { pdfToMarkdown, type PdfResult } from "./pdf-to-markdown";

function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size={wide ? "lg" : "md"}>
        <Modal.Dialog aria-label={title} className={wide ? "sm:max-w-3xl" : "sm:max-w-md"}>
          <Modal.CloseTrigger />
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            {children}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Nueva nota: título, carpeta y plantilla opcional. */
export function NewNoteDialog({
  folders,
  templates,
  defaultFolder,
  defaultTitle = "",
  onCreate,
  onClose,
}: {
  folders: string[];
  templates: NoteSummary[];
  defaultFolder: string;
  defaultTitle?: string;
  onCreate: (input: { title: string; folder: string; templateId: number | null }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [folder, setFolder] = useState(defaultFolder);
  const [template, setTemplate] = useState("-");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Dialog title="Nueva nota" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(await onCreate({ title, folder, templateId: template === "-" ? null : Number(template) }));
          setPending(false);
        }}
      >
        <Input aria-label="Título" placeholder="Título de la nota" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        <Input aria-label="Carpeta" placeholder="Carpeta (p. ej. procesos/admisiones)" value={folder} onChange={(e) => setFolder(e.target.value)} list="vault-folders" />
        <datalist id="vault-folders">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <AppSelect aria-label="Plantilla" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="-">Sin plantilla</option>
          {templates.map((t) => (
            <option key={t.id} value={String(t.id)}>
              Plantilla: {t.title}
            </option>
          ))}
        </AppSelect>
        <p className="text-xs text-muted">Las plantillas son las notas de la carpeta “{TEMPLATE_FOLDER}”: puedes editarlas o agregar más.</p>
        {error && <p className="text-sm text-red">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" isPending={pending} isDisabled={!title.trim()}>
            Crear nota
          </Button>
          <Button variant="outline" onPress={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Buscador rápido de notas (Ctrl/Cmd+K): por título, ruta o tag. */
export function QuickSwitcher({
  notes,
  onOpen,
  onCreate,
  onClose,
}: {
  notes: NoteSummary[];
  onOpen: (id: number) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const list = useMemo(() => {
    const k = normalizeKey(q);
    const scored = notes
      .map((n) => {
        const t = normalizeKey(n.title);
        const score = !k ? 1 : t.startsWith(k) ? 3 : t.includes(k) ? 2 : normalizeKey(n.path).includes(k) || n.tags.some((g) => g.includes(k)) ? 1 : 0;
        return { n, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.n.title.localeCompare(b.n.title, "es"));
    return scored.slice(0, 30).map((x) => x.n);
  }, [notes, q]);
  const box = useRef<HTMLUListElement>(null);
  useEffect(() => {
    box.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  return (
    <Dialog title="Buscar nota" onClose={onClose}>
      <Input
        aria-label="Buscar nota"
        placeholder="Escribe el título, carpeta o #tag…"
        value={q}
        autoFocus
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, list.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (list[sel]) onOpen(list[sel].id);
            else if (q.trim()) onCreate(q.trim());
          }
        }}
      />
      <ul ref={box} role="listbox" aria-label="Notas" className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
        {list.map((n, i) => (
          <li
            key={n.id}
            role="option"
            aria-selected={i === sel}
            className={`cursor-pointer rounded-lg px-2 py-1.5 text-sm ${i === sel ? "bg-primary text-primary-foreground" : "hover:bg-default"}`}
            onMouseEnter={() => setSel(i)}
            onClick={() => onOpen(n.id)}
          >
            <span className="font-medium">{n.title}</span>
            <span className={`ml-2 text-xs ${i === sel ? "opacity-80" : "text-muted"}`}>{n.path}</span>
          </li>
        ))}
        {list.length === 0 && q.trim() && (
          <li>
            <Button size="sm" variant="ghost" className="text-primary" onPress={() => onCreate(q.trim())}>
              + Crear la nota “{q.trim()}”
            </Button>
          </li>
        )}
      </ul>
      <p className="text-xs text-muted">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
    </Dialog>
  );
}

/** Conversor de PDF a nota: se extrae el texto en el navegador y se revisa antes de guardar. */
export function PdfImportDialog({
  folders,
  defaultFolder,
  onCreate,
  onClose,
}: {
  folders: string[];
  defaultFolder: string;
  onCreate: (input: { title: string; folder: string; content: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<PdfResult | null>(null);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState(defaultFolder || "documentos");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const read = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) return setError("El PDF pesa más de 40 MB.");
    setError(null);
    setResult(null);
    setProgress("Leyendo el PDF…");
    try {
      const r = await pdfToMarkdown(file, (p, t) => setProgress(`Leyendo página ${p} de ${t}…`));
      setResult(r);
      setTitle(r.title);
      setContent(`---\nfuente: ${file.name.replace(/[\n:]/g, " ")}\nimportado: ${new Date().toISOString().slice(0, 10)}\n---\n${r.markdown}`);
    } catch (e) {
      console.error("[pdf]", e);
      setError("No se pudo leer el PDF (¿está protegido con contraseña o dañado?).");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog title="Convertir PDF en nota" onClose={onClose} wide>
      <p className="text-sm text-muted">
        El texto se extrae en tu navegador (el PDF no se sube). Revisa y corrige el resultado antes de crear la nota: los títulos se
        detectan por el tamaño de la letra; tablas y columnas pueden necesitar retoques.
      </p>
      <label
        className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm hover:bg-default"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          read(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="font-medium">{result ? "Elegir otro PDF" : "Elegir un PDF"}</span>
        <span className="text-xs text-muted">o arrástralo aquí</span>
        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => read(e.target.files?.[0])} aria-label="Archivo PDF" />
      </label>
      {progress && <p className="text-sm text-muted" role="status">{progress}</p>}
      {error && <p className="text-sm text-red">{error}</p>}
      {result && (
        <>
          <p className={`rounded-lg px-3 py-2 text-xs ${result.scanned ? "bg-yellow-bg text-yellow" : "bg-green-bg text-green"}`}>
            {result.scanned
              ? `Casi no se encontró texto en ${result.pages} página(s): parece un PDF escaneado (imágenes). Para esos hace falta reconocimiento de texto (OCR), que no está incluido todavía.`
              : `${result.pages} página(s) · ${result.chars.toLocaleString("es")} caracteres extraídos.`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label="Título" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input aria-label="Carpeta" placeholder="Carpeta" value={folder} onChange={(e) => setFolder(e.target.value)} list="vault-folders-pdf" />
            <datalist id="vault-folders-pdf">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <TextArea aria-label="Contenido en Markdown" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-72 font-mono text-xs" fullWidth />
          <div className="flex gap-2">
            <Button
              variant="primary"
              isPending={pending}
              isDisabled={!title.trim() || !content.trim()}
              onPress={async () => {
                setPending(true);
                setError(await onCreate({ title, folder, content }));
                setPending(false);
              }}
            >
              Crear nota
            </Button>
            <Button variant="outline" onPress={onClose}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
