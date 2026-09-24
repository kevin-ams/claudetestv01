import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";

export type ExportFormat = "xlsm" | "xlsx";

const MIME: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
};

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EOS · Marketing";
  wb.created = new Date();
  return wb;
}

/** Encabezado en negrita con fondo, fila congelada y autofiltro. */
export function styleTable(sheet: ExcelJS.Worksheet, columns: { header: string; key: string; width?: number }[]) {
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14 }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF234C6A" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

export const FILL = {
  green: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F6EC" } } as ExcelJS.Fill,
  yellow: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF6DC" } } as ExcelJS.Fill,
  red: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAEA" } } as ExcelJS.Fill,
};

/**
 * Serializa el libro. Para .xlsm se marca el libro como "habilitado para
 * macros" en [Content_Types].xml: Excel lo abre como .xlsm (sin macros
 * incluidas, listo para agregar las propias).
 */
export async function workbookFile(wb: ExcelJS.Workbook, format: ExportFormat): Promise<Uint8Array> {
  const xlsx = new Uint8Array(await wb.xlsx.writeBuffer());
  if (format === "xlsx") return xlsx;
  const zip = await JSZip.loadAsync(xlsx);
  const types = await zip.file("[Content_Types].xml")!.async("string");
  zip.file(
    "[Content_Types].xml",
    types.replace(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
      "application/vnd.ms-excel.sheet.macroEnabled.main+xml"
    )
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export function fileResponse(data: Uint8Array, baseName: string, format: ExportFormat) {
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename="${baseName}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function parseFormat(value: string | null): ExportFormat {
  return value === "xlsx" ? "xlsx" : "xlsm";
}
