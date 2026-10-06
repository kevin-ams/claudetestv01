import "server-only";
import { db } from "@/lib/db";

export type Campana = {
  id: number;
  facultad_id: number;
  nombre: string;
  descripcion: string;
  created_at: string;
};

export type CampanaResumen = {
  /** null = artes sin campaña ("Otros artes"). */
  id: number | null;
  nombre: string;
  descripcion: string;
  total: number;
  pendientes: number;
  cambios: number;
  aprobados: number;
  proxima_fecha: string | null;
};

export async function listCampanas(facultadId: number): Promise<Campana[]> {
  const rows = await db().sql`
    SELECT * FROM campanas WHERE facultad_id = ${facultadId} ORDER BY nombre ASC
  `;
  return rows as Campana[];
}

/**
 * Campañas de la facultad con el conteo de artes por estado. Si hay artes sin
 * campaña, se agregan al final como "Otros artes" (id null).
 */
export async function listCampanasResumen(facultadId: number): Promise<CampanaResumen[]> {
  const rows = (await db().sql`
    SELECT c.id, c.nombre, c.descripcion,
      COUNT(a.id)::int AS total,
      COUNT(a.id) FILTER (WHERE a.estado = 'pendiente')::int AS pendientes,
      COUNT(a.id) FILTER (WHERE a.estado = 'cambios')::int AS cambios,
      COUNT(a.id) FILTER (WHERE a.estado = 'aprobado')::int AS aprobados,
      TO_CHAR(MIN(a.fecha_publicacion) FILTER (WHERE a.estado <> 'aprobado'), 'YYYY-MM-DD') AS proxima_fecha
    FROM campanas c
    LEFT JOIN artes a ON a.campana_id = c.id
    WHERE c.facultad_id = ${facultadId}
    GROUP BY c.id
    UNION ALL
    SELECT NULL, 'Otros artes', 'Artes que no pertenecen a una campaña.',
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE estado = 'pendiente')::int,
      COUNT(*) FILTER (WHERE estado = 'cambios')::int,
      COUNT(*) FILTER (WHERE estado = 'aprobado')::int,
      TO_CHAR(MIN(fecha_publicacion) FILTER (WHERE estado <> 'aprobado'), 'YYYY-MM-DD')
    FROM artes
    WHERE facultad_id = ${facultadId} AND campana_id IS NULL
    HAVING COUNT(*) > 0
  `) as CampanaResumen[];
  // Primero las que tienen algo por revisar; "Otros artes" siempre al final.
  return rows.sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    const porRevisar = b.pendientes + b.cambios - (a.pendientes + a.cambios);
    return porRevisar !== 0 ? porRevisar : a.nombre.localeCompare(b.nombre, "es");
  });
}

/** Devuelve la campaña solo si pertenece a la facultad indicada. */
export async function getCampana(id: number, facultadId?: number): Promise<Campana | null> {
  const rows = await db().sql`SELECT * FROM campanas WHERE id = ${id}`;
  const campana = (rows[0] as Campana) ?? null;
  if (!campana) return null;
  if (facultadId !== undefined && campana.facultad_id !== facultadId) return null;
  return campana;
}

export async function createCampana(facultadId: number, nombre: string, descripcion: string): Promise<number> {
  const rows = await db().sql`
    INSERT INTO campanas (facultad_id, nombre, descripcion)
    VALUES (${facultadId}, ${nombre}, ${descripcion})
    RETURNING id
  `;
  return (rows[0] as { id: number }).id;
}

export async function updateCampana(id: number, nombre: string, descripcion: string) {
  await db().sql`UPDATE campanas SET nombre = ${nombre}, descripcion = ${descripcion} WHERE id = ${id}`;
}

export async function deleteCampana(id: number) {
  await db().sql`DELETE FROM campanas WHERE id = ${id}`;
}
