"use client";

import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap, placeholder, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

export type LinkOption = { label: string; detail?: string; apply?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Opciones para [[ : títulos de notas y entidades EOS ("rock:Nombre"). */
  options: LinkOption[];
  onOpenLink: (target: string) => void;
  onSave: () => void;
  readOnly?: boolean;
};

const WIKI = /\[\[([^[\]\n]+?)\]\]/g;
const linkMark = Decoration.mark({ class: "cm-wikilink" });
const eosMark = Decoration.mark({ class: "cm-wikilink cm-wikilink-eos" });

function wikiDecorations(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const m of text.matchAll(WIKI)) {
      const start = from + m.index!;
      b.add(start, start + m[0].length, /^(rock|issue|kpi):/i.test(m[1]) ? eosMark : linkMark);
    }
  }
  return b.finish();
}

const wikiPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikiDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = wikiDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/** Destino del [[enlace]] bajo la posición, si hay uno. */
function linkAt(state: EditorState, pos: number): string | null {
  const line = state.doc.lineAt(pos);
  for (const m of line.text.matchAll(WIKI)) {
    const from = line.from + m.index!;
    if (pos >= from && pos <= from + m[0].length) return m[1].split("|")[0].split("#")[0].trim();
  }
  return null;
}

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.5em", fontWeight: "700" },
  { tag: t.heading2, fontSize: "1.3em", fontWeight: "700" },
  { tag: t.heading3, fontSize: "1.12em", fontWeight: "700" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--accent)" },
  { tag: t.url, color: "var(--muted)" },
  { tag: [t.monospace], fontFamily: "ui-monospace, monospace", color: "var(--accent)" },
  { tag: [t.quote], color: "var(--muted)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.meta], color: "var(--muted)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "15px", backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.65" },
  ".cm-content": { padding: "16px 4px", caretColor: "var(--foreground)" },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in oklab, var(--accent) 22%, transparent) !important" },
  ".cm-wikilink": { color: "var(--accent)", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" },
  ".cm-wikilink-eos": { color: "var(--success, #16a34a)" },
  ".cm-tooltip": { backgroundColor: "var(--overlay, var(--background))", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" },
  ".cm-placeholder": { color: "var(--muted)" },
  ".cm-panels": { backgroundColor: "var(--background)", color: "var(--foreground)", borderColor: "var(--border)" },
});

/** Editor Markdown (CodeMirror 6) con [[enlaces]], autocompletado y Ctrl/Cmd+clic para abrir. */
export function MarkdownEditor({ value, onChange, options, onOpenLink, onSave, readOnly = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Cambios que llegan de fuera (versión del servidor, restaurar): no cuentan como edición.
  const external = useRef(false);
  // Callbacks y opciones actuales sin reconstruir el editor.
  const latest = useRef({ onChange, options, onOpenLink, onSave });
  useEffect(() => {
    latest.current = { onChange, options, onOpenLink, onSave };
  });

  useEffect(() => {
    if (!host.current) return;
    const complete = (ctx: CompletionContext): CompletionResult | null => {
      const before = ctx.matchBefore(/\[\[[^[\]\n]*/);
      if (!before) return null;
      const query = before.text.slice(2);
      return {
        from: before.from + 2,
        options: latest.current.options.map((o) => ({
          label: o.label,
          detail: o.detail,
          apply: (v: EditorView, _c: unknown, from: number, to: number) => {
            const text = o.apply ?? o.label;
            const after = v.state.doc.sliceString(to, to + 2);
            const insert = after === "]]" ? text : `${text}]]`;
            v.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length + (after === "]]" ? 2 : 0) } });
          },
        })),
        validFor: /^[^[\]\n]*$/,
        filter: query.length > 0,
      };
    };

    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          closeBrackets(),
          markdown(),
          syntaxHighlighting(highlight),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          placeholder("Escribe en Markdown. Usa [[ para enlazar otra nota o [[rock:, [[issue:, [[kpi: para enlazar EOS."),
          autocompletion({ override: [complete], activateOnTyping: true }),
          wikiPlugin,
          theme,
          EditorState.readOnly.of(readOnly),
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => (latest.current.onSave(), true) },
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...defaultKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !external.current) latest.current.onChange(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            mousedown: (e, view) => {
              if (!(e.ctrlKey || e.metaKey)) return false;
              const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
              const target = pos === null ? null : linkAt(view.state, pos);
              if (!target) return false;
              e.preventDefault();
              latest.current.onOpenLink(target);
              return true;
            },
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // El editor se crea una vez por nota (el padre usa key={note.id}).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Si el contenido cambia desde fuera (versión del servidor, restaurar), se reemplaza.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      external.current = true;
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
      external.current = false;
    }
  }, [value]);

  return <div ref={host} className="vault-editor h-full min-h-[60vh]" />;
}
