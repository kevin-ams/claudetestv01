"use client";

import { useMemo } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { EOS_LABEL, extractWikilinks, parseFrontmatter, type EosEntity, type EosKind } from "@/lib/domain/vault-shared";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, defaultSchema)
  .use(rehypeStringify);

const mdEscape = (s: string) => s.replace(/([\\[\]()*_`])/g, "\\$1");
const enc = (s: string) => encodeURIComponent(s).replace(/\(/g, "%28").replace(/\)/g, "%29");

/**
 * Convierte [[Nota|texto]] en enlaces "#wl:Nota" y [[rock:12]] en "#eos:rock:12" (con el nombre de la
 * entidad), para que el Markdown los muestre y la vista previa los abra.
 */
function linkify(body: string, exists: (target: string) => boolean, entity: (kind: EosKind, ref: string) => EosEntity | null): string {
  let out = "";
  let last = 0;
  for (const l of extractWikilinks(body)) {
    out += body.slice(last, l.index);
    last = l.index + l.raw.length;
    // #wl: nota que existe · #wlx: nota que no existe (se ofrece crearla) · #eos: rock, issue o KPI.
    if (l.kind === "note") {
      out += `[${mdEscape(l.alias ?? l.target)}](#${exists(l.target) ? "wl" : "wlx"}:${enc(l.target)})`;
    } else {
      const e = entity(l.kind, l.ref);
      const label = `${EOS_LABEL[l.kind]}: ${l.alias ?? e?.title ?? l.ref}${e ? "" : " (no encontrado)"}`;
      out += `[${mdEscape(label)}](#eos:${l.kind}:${enc(e ? String(e.id) : l.ref)})`;
    }
  }
  return out + body.slice(last);
}

/** Vista previa de la nota (Markdown sanitizado). Los clics en enlaces internos los maneja `onLink`. */
export function NotePreview({
  content,
  exists,
  entity,
  onLink,
}: {
  content: string;
  exists: (target: string) => boolean;
  entity: (kind: EosKind, ref: string) => EosEntity | null;
  onLink: (href: string) => void;
}) {
  const { data, body } = useMemo(() => parseFrontmatter(content), [content]);
  const html = useMemo(() => {
    try {
      return String(processor.processSync(linkify(body, exists, entity)));
    } catch {
      return "<p>No se pudo mostrar la vista previa.</p>";
    }
  }, [body, exists, entity]);

  const meta = Object.entries(data).filter(([k]) => k !== "tags");
  return (
    <div className="flex flex-col gap-3">
      {meta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          {meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 break-words">{Array.isArray(v) ? v.join(", ") : v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "")}</dd>
            </div>
          ))}
        </dl>
      )}
      <div
        className="vault-prose"
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest("a");
          const href = a?.getAttribute("href") ?? "";
          if (/^#(wl|wlx|eos):/.test(href)) {
            e.preventDefault();
            onLink(href);
          } else if (a && /^https?:/.test(href)) {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
          }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
