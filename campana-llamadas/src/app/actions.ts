"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { isCallsSheet } from "@/lib/calls/parse";
import { saveUpload } from "@/lib/calls/storage";
import { readWorkbook } from "@/lib/calls/xlsx";

const MAX_BYTES = 4 * 1024 * 1024;

export type UploadResult = { error: string } | { ok: true; sheets: number };

export async function uploadCallsAction(formData: FormData): Promise<UploadResult> {
  const session = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo." };
  if (!/\.xlsx$/i.test(file.name)) {
    return { error: "El archivo debe ser Excel (.xlsx). En Google Sheets: Archivo → Descargar → Microsoft Excel." };
  }
  if (file.size > MAX_BYTES) return { error: "El archivo pesa más de 4 MB." };

  let sheets;
  try {
    sheets = await readWorkbook(await file.arrayBuffer());
  } catch {
    return { error: "No se pudo leer el archivo. Verifica que sea un .xlsx válido." };
  }

  const callSheets = sheets.filter((s) => isCallsSheet(s.values));
  if (!callSheets.length) {
    return {
      error: "No encontré ninguna pestaña con las columnas CARRERA y ESTADO LLAMADA en la primera fila.",
    };
  }

  // Solo guardamos las pestañas de contactos (el guion y las opciones no hacen falta).
  await saveUpload({
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.name,
    sheets: callSheets,
  });
  revalidatePath("/");
  return { ok: true, sheets: callSheets.length };
}
