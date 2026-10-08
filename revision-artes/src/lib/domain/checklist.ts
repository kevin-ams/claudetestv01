import "server-only";
import { db } from "@/lib/db";

export type MarcaChecklist = { por: string; en: string };

/**
 * Cambios que Diseño debe hacer en la versión actual de un arte: los puntos
 * abiertos ('p:<id>') y los comentarios generales de "solicitar cambios" ('c:<id>').
 */
export async function itemsRequeridos(arteId: number, version: number): Promise<string[]> {
  const puntos = await db().sql`
    SELECT id FROM anotaciones WHERE arte_id = ${arteId} AND version = ${version} AND NOT atendida
  `;
  const comentarios = await db().sql`
    SELECT id FROM revisiones
    WHERE arte_id = ${arteId} AND version = ${version} AND accion = 'cambios' AND comentario <> ''
  `;
  return [
    ...(puntos as { id: number }[]).map((p) => `p:${p.id}`),
    ...(comentarios as { id: number }[]).map((c) => `c:${c.id}`),
  ];
}

/** Marcas del checklist de la versión actual de cada arte de la campaña. */
export async function marcasCampana(campanaId: number): Promise<Map<number, Record<string, MarcaChecklist>>> {
  const rows = (await db().sql`
    SELECT ch.arte_id, ch.item, ch.hecho_por, ch.hecho_en
    FROM checklist_diseno ch
    JOIN artes a ON a.id = ch.arte_id AND ch.version = a.version
    WHERE a.campana_id = ${campanaId}
  `) as { arte_id: number; item: string; hecho_por: string; hecho_en: string }[];
  const mapa = new Map<number, Record<string, MarcaChecklist>>();
  for (const r of rows) {
    const marcas = mapa.get(r.arte_id) ?? {};
    marcas[r.item] = { por: r.hecho_por, en: new Date(r.hecho_en).toISOString() };
    mapa.set(r.arte_id, marcas);
  }
  return mapa;
}

export async function marcarItem(arteId: number, version: number, item: string, hecho: boolean, por: string) {
  if (hecho) {
    await db().sql`
      INSERT INTO checklist_diseno (arte_id, version, item, hecho_por)
      VALUES (${arteId}, ${version}, ${item}, ${por})
      ON CONFLICT (arte_id, version, item) DO NOTHING
    `;
  } else {
    await db().sql`
      DELETE FROM checklist_diseno WHERE arte_id = ${arteId} AND version = ${version} AND item = ${item}
    `;
  }
}

/** ¿Están hechos todos los cambios requeridos de la versión actual del arte? */
export async function arteCompleto(arteId: number, version: number): Promise<boolean> {
  const requeridos = await itemsRequeridos(arteId, version);
  if (requeridos.length === 0) return false;
  const hechos = (await db().sql`
    SELECT item FROM checklist_diseno WHERE arte_id = ${arteId} AND version = ${version}
  `) as { item: string }[];
  const set = new Set(hechos.map((h) => h.item));
  return requeridos.every((i) => set.has(i));
}
