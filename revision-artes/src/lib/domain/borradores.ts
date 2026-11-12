import "server-only";
import { db } from "@/lib/db";

/** Punto marcado en el portal que todavía no se envía con una revisión. */
export type PuntoBorrador = { id: number; x: number; y: number; comentario: string };

const normalizar = (r: PuntoBorrador): PuntoBorrador => ({
  id: r.id,
  x: Number(r.x),
  y: Number(r.y),
  comentario: r.comentario,
});

export async function listBorradores(arteId: number, version: number, email: string): Promise<PuntoBorrador[]> {
  const rows = (await db().sql`
    SELECT id, x, y, comentario FROM puntos_borrador
    WHERE arte_id = ${arteId} AND version = ${version} AND autor_email = ${email.toLowerCase()}
    ORDER BY id ASC
  `) as PuntoBorrador[];
  return rows.map(normalizar);
}

/** Crea o actualiza un borrador (solo los de la misma persona y arte). */
export async function guardarBorrador(input: {
  id?: number;
  arteId: number;
  version: number;
  email: string;
  x: number;
  y: number;
  comentario: string;
}): Promise<PuntoBorrador | null> {
  const email = input.email.toLowerCase();
  const rows = input.id
    ? await db().sql`
        UPDATE puntos_borrador SET x = ${input.x}, y = ${input.y}, comentario = ${input.comentario}, updated_at = NOW()
        WHERE id = ${input.id} AND arte_id = ${input.arteId} AND autor_email = ${email}
        RETURNING id, x, y, comentario
      `
    : await db().sql`
        INSERT INTO puntos_borrador (arte_id, version, autor_email, x, y, comentario)
        VALUES (${input.arteId}, ${input.version}, ${email}, ${input.x}, ${input.y}, ${input.comentario})
        RETURNING id, x, y, comentario
      `;
  const r = rows[0] as PuntoBorrador | undefined;
  return r ? normalizar(r) : null;
}

/** Vuelve a leer un borrador de la base, para confirmar que quedó guardado. */
export async function leerBorrador(id: number, email: string): Promise<PuntoBorrador | null> {
  const rows = await db().sql`
    SELECT id, x, y, comentario FROM puntos_borrador WHERE id = ${id} AND autor_email = ${email.toLowerCase()}
  `;
  const r = rows[0] as PuntoBorrador | undefined;
  return r ? normalizar(r) : null;
}

export async function borrarBorrador(id: number, arteId: number, email: string) {
  await db().sql`
    DELETE FROM puntos_borrador WHERE id = ${id} AND arte_id = ${arteId} AND autor_email = ${email.toLowerCase()}
  `;
}

/** Al enviar la revisión, los borradores pasan a ser puntos de la revisión. */
export async function borrarBorradoresDe(arteId: number, version: number, email: string) {
  await db().sql`
    DELETE FROM puntos_borrador
    WHERE arte_id = ${arteId} AND version = ${version} AND autor_email = ${email.toLowerCase()}
  `;
}
