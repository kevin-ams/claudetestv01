import "server-only";
import ExcelJS from "exceljs";
import type { RawSheet } from "./parse";

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel guarda fechas y horas como fechas UTC; las horas solas caen el 1899-12-30. */
function formatDate(d: Date): string {
  const time = `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
  if (d.getUTCFullYear() < 1901) return time;
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hasTime = d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds();
  return hasTime ? `${day} ${time}:${pad(d.getUTCSeconds())}` : day;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
    return "";
  }
  return String(value);
}

/** Lee todas las pestañas de un .xlsx como texto, fila por fila. */
export async function readWorkbook(data: ArrayBuffer): Promise<RawSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return workbook.worksheets.map((ws) => {
    const values: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellText(cell.value).trim();
      });
      const filled = Array.from(cells, (c) => c ?? "");
      while (filled.length && !filled[filled.length - 1]) filled.pop();
      if (filled.length) values.push(filled);
    });
    return { title: ws.name, values };
  });
}
