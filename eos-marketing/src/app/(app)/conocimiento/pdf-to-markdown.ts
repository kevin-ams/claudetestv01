"use client";

// Conversor de PDF a Markdown en el navegador (pdf.js): títulos por tamaño de letra, listas y párrafos.
// El PDF no sale del navegador. Los PDF escaneados (imágenes) no traen texto: se avisa.

type Item = { str: string; x: number; y: number; size: number; width: number; bold: boolean };
type Line = { text: string; y: number; size: number; bold: boolean; page: number };

export type PdfResult = { markdown: string; title: string; pages: number; chars: number; scanned: boolean };

const BULLET = /^[•●▪◦‣■□➢►‒–—-]\s*/;

export async function pdfToMarkdown(file: File, onProgress?: (page: number, total: number) => void): Promise<PdfResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: Line[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(p, doc.numPages);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const styles = tc.styles as Record<string, { fontFamily?: string }>;
    const items: Item[] = [];
    for (const raw of tc.items) {
      if (!("str" in raw)) continue;
      const it = raw as { str: string; transform: number[]; width: number; height: number; fontName: string };
      if (!it.str.trim()) continue;
      const size = Math.round(Math.max(it.height, Math.abs(it.transform[3])) * 10) / 10;
      const font = `${it.fontName} ${styles[it.fontName]?.fontFamily ?? ""}`;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], size, width: it.width, bold: /bold|black|heavy|semibold/i.test(font) });
    }
    // Agrupa por renglón (misma altura) y ordena de arriba a abajo, de izquierda a derecha.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur: Item[] = [];
    const flush = () => {
      if (!cur.length) return;
      cur.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const it of cur) {
        const gap = it.x - end;
        text += text && gap > it.size * 0.25 && !text.endsWith(" ") && !it.str.startsWith(" ") ? ` ${it.str}` : it.str;
        end = it.x + it.width;
      }
      const size = Math.max(...cur.map((i) => i.size));
      lines.push({ text: text.replace(/\s+/g, " ").trim(), y: cur[0].y, size, bold: cur.every((i) => i.bold), page: p });
      cur = [];
    };
    for (const it of items) {
      if (cur.length && Math.abs(cur[0].y - it.y) > Math.max(2, it.size * 0.4)) flush();
      cur.push(it);
    }
    flush();
  }

  const chars = lines.reduce((s, l) => s + l.text.length, 0);
  const pages = doc.numPages;

  // Encabezados y pies que se repiten en muchas páginas (y números de página) se quitan.
  const freq = new Map<string, Set<number>>();
  for (const l of lines) {
    const k = l.text.replace(/\d+/g, "#");
    if (!freq.has(k)) freq.set(k, new Set());
    freq.get(k)!.add(l.page);
  }
  const repeated = (l: Line) => pages >= 3 && (freq.get(l.text.replace(/\d+/g, "#"))?.size ?? 0) >= Math.max(3, pages * 0.5);
  const kept = lines.filter((l) => l.text && !/^(p[aá]g(ina)?\.?\s*)?\d+(\s*(de|\/)\s*\d+)?$/i.test(l.text) && !repeated(l));

  // Tamaño del texto normal: el más común (por cantidad de letras).
  const bySize = new Map<number, number>();
  for (const l of kept) bySize.set(l.size, (bySize.get(l.size) ?? 0) + l.text.length);
  const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const headingLevel = (l: Line) => {
    if (l.text.length > 120 || (/[.,;:]$/.test(l.text) && l.size < body * 1.3)) return 0;
    if (l.size >= body * 1.6) return 1;
    if (l.size >= body * 1.3) return 2;
    if (l.size >= body * 1.12 || (l.bold && l.text.length < 80 && !/[.,;]$/.test(l.text))) return 3;
    return 0;
  };

  const out: string[] = [];
  let para = "";
  let prev: Line | null = null;
  const isItem = (t: string) => /^(- |\d{1,2}[.)]\s)/.test(t);
  const endPara = (nextIsItem = false) => {
    if (para) {
      // Los elementos de una lista van seguidos (sin línea en blanco entre ellos).
      out.push(para);
      if (!(isItem(para) && nextIsItem)) out.push("");
    }
    para = "";
  };
  for (const l of kept) {
    const level = headingLevel(l);
    const newPage = prev && prev.page !== l.page;
    const bigGap = prev && !newPage && prev.y - l.y > Math.max(prev.size, l.size) * 1.9;
    if (level) {
      endPara();
      // Un título partido en dos renglones se une.
      const last = out.length >= 2 ? out[out.length - 2] : "";
      if (prev && headingLevel(prev) === level && !bigGap && !newPage && last.startsWith("#".repeat(level) + " ")) {
        out[out.length - 2] = `${last} ${l.text}`;
      } else {
        out.push(`${"#".repeat(level)} ${l.text}`, "");
      }
    } else if (BULLET.test(l.text) || /^\d{1,2}[.)]\s/.test(l.text)) {
      endPara(true);
      para = BULLET.test(l.text) ? `- ${l.text.replace(BULLET, "")}` : l.text;
    } else if (!para || bigGap || newPage) {
      endPara();
      para = l.text;
    } else if (para.endsWith("-") && /^[a-záéíóúñ]/.test(l.text)) {
      para = para.slice(0, -1) + l.text; // palabra cortada con guion
    } else {
      para += ` ${l.text}`;
    }
    prev = l;
  }
  endPara();

  const markdown = out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  const firstHeading = /^#{1,2} (.+)$/m.exec(markdown)?.[1];
  const title = (firstHeading ?? file.name.replace(/\.pdf$/i, "")).slice(0, 140);
  return { markdown, title, pages, chars, scanned: chars < pages * 40 };
}
