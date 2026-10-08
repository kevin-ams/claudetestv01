"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getArte } from "@/lib/domain/artes";
import { getCampana } from "@/lib/domain/campanas";
import { getFacultad } from "@/lib/domain/facultades";
import { crearAviso } from "@/lib/domain/avisos";
import { arteCompleto, itemsRequeridos, marcarItem } from "@/lib/domain/checklist";
import { campanaPorToken } from "@/lib/domain/reporte";
import { db } from "@/lib/db";

const entrada = z.object({
  token: z.string().min(20).max(100),
  arteId: z.number().int().positive(),
  item: z.string().regex(/^[pc]:\d+$/),
  hecho: z.boolean(),
  nombre: z.string().trim().max(80),
});

export type ResultadoMarca = { ok: boolean; error?: string };

/**
 * Marca o desmarca un cambio del checklist de Diseño. Solo con el enlace
 * secreto del reporte y solo para cambios de la versión actual de artes de
 * esa campaña. Si con esto el arte queda completo, avisa en el panel.
 */
export async function marcarCambioAction(input: z.input<typeof entrada>): Promise<ResultadoMarca> {
  const parsed = entrada.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { token, arteId, item, hecho, nombre } = parsed.data;

  const campanaId = await campanaPorToken(token);
  if (!campanaId) return { ok: false, error: "El enlace ya no es válido. Pide uno nuevo a Marketing Digital." };
  const arte = await getArte(arteId);
  if (!arte || arte.campana_id !== campanaId) return { ok: false, error: "El arte no pertenece a este reporte" };
  if (!(await itemsRequeridos(arte.id, arte.version)).includes(item)) {
    return { ok: false, error: "Este cambio ya no está pendiente. Recarga el reporte." };
  }

  await marcarItem(arte.id, arte.version, item, hecho, nombre);

  if (hecho && (await arteCompleto(arte.id, arte.version))) {
    const campana = await getCampana(campanaId);
    const facultad = campana ? await getFacultad(campana.facultad_id) : null;
    const otros = (await db().sql`
      SELECT id, version FROM artes WHERE campana_id = ${campanaId} AND estado = 'cambios' AND id <> ${arte.id}
    `) as { id: number; version: number }[];
    let campanaLista = true;
    for (const o of otros) {
      if (!(await arteCompleto(o.id, o.version))) {
        campanaLista = false;
        break;
      }
    }
    await crearAviso({
      clave: `diseno:${arte.id}:v${arte.version}`,
      titulo: `Diseño terminó los cambios de “${arte.titulo}”`,
      mensaje:
        `v${arte.version} · ${campana?.nombre ?? ""}${facultad ? ` · ${facultad.nombre}` : ""}.` +
        (nombre ? ` Marcado por ${nombre}.` : "") +
        (campanaLista ? " Con esto, todos los cambios de la campaña están listos." : "") +
        " Ya puedes subir la nueva versión.",
      url: `/admin/artes/${arte.id}#nueva-version`,
    });
  }

  revalidatePath(`/reporte/${token}`);
  return { ok: true };
}
