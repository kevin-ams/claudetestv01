import "server-only";
import { db } from "@/lib/db";

export type Aviso = {
  id: number;
  titulo: string;
  mensaje: string;
  url: string;
  created_at: string;
  leido: boolean;
};

/** Crea un aviso para todos los administradores. Con `clave` no se repite. */
export async function crearAviso(input: { clave?: string; titulo: string; mensaje: string; url: string }) {
  await db().sql`
    INSERT INTO avisos (clave, titulo, mensaje, url)
    VALUES (${input.clave ?? null}, ${input.titulo}, ${input.mensaje}, ${input.url})
    ON CONFLICT (clave) DO NOTHING
  `;
}

/** Últimos avisos y total de no leídos en una sola consulta (para la campanita). */
export async function avisosConConteo(adminId: number, limit = 20): Promise<{ avisos: Aviso[]; noLeidos: number }> {
  const rows = (await db().sql`
    SELECT a.id, a.titulo, a.mensaje, a.url, a.created_at, (l.aviso_id IS NOT NULL) AS leido,
      (COUNT(*) FILTER (WHERE l.aviso_id IS NULL) OVER ())::int AS no_leidos
    FROM avisos a
    LEFT JOIN avisos_leidos l ON l.aviso_id = a.id AND l.admin_id = ${adminId}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${limit}
  `) as (Aviso & { no_leidos: number })[];
  return {
    avisos: rows.map(({ no_leidos: _, ...a }) => a),
    noLeidos: rows[0]?.no_leidos ?? 0,
  };
}

export async function marcarLeido(adminId: number, avisoId: number) {
  await db().sql`
    INSERT INTO avisos_leidos (aviso_id, admin_id) VALUES (${avisoId}, ${adminId})
    ON CONFLICT DO NOTHING
  `;
}

export async function marcarTodosLeidos(adminId: number) {
  await db().sql`
    INSERT INTO avisos_leidos (aviso_id, admin_id)
    SELECT id, ${adminId} FROM avisos
    ON CONFLICT DO NOTHING
  `;
}
