import "server-only";
import { rgb, type PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

// Las fuentes estándar de PDF solo traen el juego WinAnsi (latín): se
// reemplazan símbolos fuera de él (flechas, emojis…) por equivalentes.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function clean(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/[✓✔]/g, "OK")
    .replace(/[\u2028\u2029\t]/g, " ")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return c === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(c);
    })
    .join("");
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(/^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "234c6a", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export const INK = rgb(0.09, 0.1, 0.14);
export const MUTED = rgb(0.42, 0.45, 0.5);
export const LINE = rgb(0.88, 0.89, 0.91);
export const RED = rgb(0.75, 0.17, 0.17);
export const GREEN = rgb(0.12, 0.54, 0.3);
export const SOFT = rgb(0.96, 0.97, 0.98);

export const W = 612; // carta
export const H = 792;
export const M = 48;

export class Layout {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }

  ensure(height: number) {
    if (this.y - height < M + 20) this.newPage();
  }

  wrap(text: string, size: number, width: number, font = this.font): string[] {
    const lines: string[] = [];
    for (const paragraph of clean(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: RGB; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? M;
    const lineH = size * 1.35;
    for (const line of this.wrap(text, size, opts.width ?? W - x - M, font)) {
      this.ensure(lineH);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lineH;
    }
    this.y -= opts.gap ?? 0;
  }

  heading(title: string, subtitle?: string) {
    this.ensure(48);
    this.y -= 10;
    this.text(title, { size: 13, bold: true, gap: 2 });
    if (subtitle) this.text(subtitle, { size: 9, color: MUTED, gap: 2 });
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.8, color: LINE });
    this.y -= 8;
  }

  bullet(text: string, opts: { color?: RGB; detail?: string } = {}) {
    this.ensure(14);
    this.page.drawCircle({ x: M + 4, y: this.y - 5, size: 1.8, color: opts.color ?? INK });
    this.text(text, { x: M + 12, size: 10, color: opts.color, gap: opts.detail ? 0 : 3 });
    if (opts.detail) this.text(opts.detail, { x: M + 12, size: 8.5, color: MUTED, gap: 3 });
  }

  empty(text: string) {
    this.text(text, { size: 9.5, color: MUTED, gap: 2 });
  }

  /** Tabla simple: anchos en proporción, encabezado gris. */
  table(columns: { label: string; width: number; align?: "right" }[], rows: { cells: string[]; color?: RGB }[]) {
    const total = W - 2 * M;
    const xs: number[] = [];
    let acc = M;
    for (const c of columns) {
      xs.push(acc);
      acc += c.width * total;
    }
    const drawRow = (cells: string[], header: boolean, color?: RGB) => {
      const size = header ? 8.5 : 9.5;
      const font = header ? this.bold : this.font;
      const wrapped = cells.map((c, i) => this.wrap(c, size, columns[i].width * total - 8, font));
      const height = Math.max(...wrapped.map((l) => l.length)) * size * 1.3 + 6;
      this.ensure(height);
      if (header) this.page.drawRectangle({ x: M, y: this.y - height, width: total, height, color: SOFT });
      wrapped.forEach((lines, i) => {
        lines.forEach((line, j) => {
          const w = font.widthOfTextAtSize(line, size);
          const x = columns[i].align === "right" ? xs[i] + columns[i].width * total - 4 - w : xs[i] + 4;
          this.page.drawText(line, { x, y: this.y - 3 - size - j * size * 1.3, size, font, color: header ? MUTED : (color ?? INK) });
        });
      });
      this.y -= height;
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.5, color: LINE });
    };
    drawRow(columns.map((c) => c.label.toUpperCase()), true);
    for (const r of rows) drawRow(r.cells, false, r.color);
    this.y -= 6;
  }
}

