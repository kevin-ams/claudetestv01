import { CATALOG, CATEGORIES, getCatalogItem } from "@/lib/plano/catalog";
import type { ElectricalReport } from "@/lib/plano/electrical";
import type { Plan } from "@/lib/plano/types";
import { PX } from "./symbol";

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeName(plan: Plan) {
  return plan.name.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().replace(/\s+/g, "-") || "plano";
}

/** Serialises the live canvas, cropped to the stage, without editor UI. */
export function stageSvg(svg: SVGSVGElement, plan: Plan) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
  clone.querySelectorAll("[data-bg]").forEach((n) => n.setAttribute("fill", "#ffffff"));
  const m = 0.9 * PX;
  const x = -m;
  const y = -m;
  const w = plan.stage.width * PX + m * 2;
  const h = plan.stage.depth * PX + m * 2;
  clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("class");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.querySelector("defs")?.nextSibling ?? clone.firstChild);
  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", String(x + 16));
  title.setAttribute("y", String(y + 26));
  title.setAttribute("font-size", "18");
  title.setAttribute("font-weight", "700");
  title.setAttribute("fill", "#0f172a");
  title.textContent = plan.name;
  clone.appendChild(title);
  return { markup: new XMLSerializer().serializeToString(clone), w, h };
}

export function exportSvg(svg: SVGSVGElement, plan: Plan) {
  const { markup } = stageSvg(svg, plan);
  download(`${safeName(plan)}.svg`, new Blob([markup], { type: "image/svg+xml" }));
}

export function renderPng(svg: SVGSVGElement, plan: Plan, scale = 2): Promise<string> {
  const { markup, w, h } = stageSvg(svg, plan);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

export async function exportPng(svg: SVGSVGElement, plan: Plan) {
  const url = await renderPng(svg, plan, 3);
  const blob = await (await fetch(url)).blob();
  download(`${safeName(plan)}.png`, blob);
}

export function exportJson(plan: Plan) {
  download(`${safeName(plan)}.plano.json`, new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
}

export function equipmentRows(plan: Plan) {
  const counts = new Map<string, { type: string; qty: number; watts: number; labels: string[] }>();
  for (const it of plan.items) {
    const row = counts.get(it.type) ?? { type: it.type, qty: 0, watts: 0, labels: [] };
    row.qty++;
    row.watts += it.watts ?? 0;
    row.labels.push(it.label);
    counts.set(it.type, row);
  }
  const order = new Map(CATALOG.map((c, i) => [c.type, i]));
  return [...counts.values()].sort((a, b) => (order.get(a.type) ?? 0) - (order.get(b.type) ?? 0));
}

export function exportCsv(plan: Plan) {
  const header = ["Categoría", "Tipo", "Etiqueta", "X (m)", "Y (m)", "Rotación", "Watts", "Kelvin", "Canal", "Conectado a", "Notas"];
  const byId = new Map(plan.items.map((i) => [i.id, i]));
  const rows = plan.items.map((i) => {
    const c = getCatalogItem(i.type);
    return [
      CATEGORIES.find((k) => k.id === c?.category)?.label ?? "",
      c?.name ?? i.type,
      i.label,
      i.x.toFixed(2),
      i.y.toFixed(2),
      String(i.rotation),
      i.watts ? String(i.watts) : "",
      i.kelvin ? String(i.kelvin) : "",
      i.channel ?? "",
      i.powerFrom ? byId.get(i.powerFrom)?.label ?? "" : "",
      i.notes,
    ];
  });
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  download(`${safeName(plan)}-equipo.csv`, new Blob(["﻿" + csv], { type: "text/csv" }));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Opens a printable sheet: plan image, equipment list and electrical report. */
export async function printReport(svg: SVGSVGElement, plan: Plan, report: ElectricalReport) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write("<p style='font-family:sans-serif'>Generando…</p>");
  const png = await renderPng(svg, plan, 2);
  const v = plan.electrical.voltage;

  const equipment = equipmentRows(plan)
    .map((r) => {
      const c = getCatalogItem(r.type);
      return `<tr><td>${esc(c?.name ?? r.type)}</td><td class=n>${r.qty}</td><td class=n>${r.watts ? r.watts + " W" : "—"}</td><td>${esc(r.labels.join(", "))}</td></tr>`;
    })
    .join("");

  const circuits = report.sources
    .map((s) => {
      const pct = s.capacity ? Math.round((s.load / s.capacity) * 100) : 0;
      const warn = [s.overloaded && "SOBRECARGA", s.overSockets && "faltan enchufes", s.floating && "sin conectar"].filter(Boolean).join(", ");
      return `<tr><td style="padding-left:${8 + s.depth * 16}px">${esc(s.item.label)}</td><td>${esc(s.parent?.label ?? "—")}</td><td class=n>${Math.round(s.load)} W / ${(s.load / v).toFixed(1)} A</td><td class=n>${pct}%</td><td class=n>${s.socketsUsed}/${s.item.source!.sockets}</td><td>${esc(s.children.map((c) => c.label).join(", "))}</td><td class=w>${warn}</td></tr>`;
    })
    .join("");

  const cables = report.cableIssues
    .map((c) => `<tr><td>${esc(c.item.label)}</td><td>${esc(c.source.label)}</td><td class=n>${c.run.toFixed(1)} m</td><td class=n>${c.cable} m</td><td class=n>${c.extension} m</td></tr>`)
    .join("");

  win.document.open();
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(plan.name)} — Plano</title>
<style>
body{font-family:system-ui,sans-serif;color:#0f172a;margin:24px}
h1{margin:0 0 4px}h2{margin:28px 0 8px;font-size:16px;border-bottom:2px solid #0f172a;padding-bottom:4px}
.meta{color:#64748b;font-size:13px}
img{width:100%;border:1px solid #cbd5e1;margin-top:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{border-bottom:1px solid #e2e8f0;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#f1f5f9}.n{text-align:right;white-space:nowrap}.w{color:#dc2626;font-weight:600}
.cards{display:flex;gap:12px;flex-wrap:wrap}.card{border:1px solid #cbd5e1;border-radius:8px;padding:8px 14px}
.card b{display:block;font-size:20px}
@media print{body{margin:10mm}h2{break-after:avoid}img{break-inside:avoid}}
</style></head><body>
<h1>${esc(plan.name)}</h1>
<div class="meta">Escenario ${plan.stage.width} × ${plan.stage.depth} m · ${plan.items.length} elementos · ${new Date().toLocaleString("es")}</div>
<img src="${png}" alt="Plano">
<h2>Resumen eléctrico</h2>
<div class="cards">
<div class="card"><b>${Math.round(report.totalWatts)} W</b>Carga total</div>
<div class="card"><b>${report.totalAmps.toFixed(1)} A</b>a ${v} V</div>
<div class="card"><b>${report.circuitsNeeded}</b>Circuitos de ${plan.electrical.circuitAmps} A (al ${Math.round(plan.electrical.safety * 100)}%)</div>
<div class="card"><b>${report.plugsNeeded}</b>Enchufes de equipos</div>
<div class="card"><b>${report.unpowered.length}</b>Equipos sin conectar</div>
</div>
${circuits ? `<h2>Tomas, regletas y extensiones</h2><table><tr><th>Fuente</th><th>Conectada a</th><th class=n>Carga</th><th class=n>Uso</th><th class=n>Enchufes</th><th>Equipos</th><th>Alertas</th></tr>${circuits}</table>` : ""}
${cables ? `<h2>Extensiones necesarias</h2><table><tr><th>Equipo</th><th>Fuente</th><th class=n>Recorrido</th><th class=n>Cable propio</th><th class=n>Extensión sugerida</th></tr>${cables}</table>` : ""}
<h2>Lista de equipo</h2>
<table><tr><th>Elemento</th><th class=n>Cant.</th><th class=n>Potencia</th><th>Etiquetas</th></tr>${equipment}</table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
  win.document.close();
  return true;
}
