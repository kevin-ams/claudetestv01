import "server-only";
import { db } from "@/lib/db";
import type { AccionRevision, EstadoArte } from "./types";

export type Arte = {
  id: number;
  facultad_id: number;
  carrera_id: number | null;
  carrera_nombre: string | null;
  titulo: string;
  campana: string;
  formato: string;
  descripcion: string;
  drive_url: string;
  fecha_publicacion: string | null;
  estado: EstadoArte;
  version: number;
  created_at: string;
  updated_at: string;
};

export type Revision = {
  id: number;
  arte_id: number;
  accion: AccionRevision;
  comentario: string;
  version: number;
  autor_tipo: "facultad" | "admin";
  autor_nombre: string;
  autor_email: string;
  created_at: string;
};

export type ArteInput = {
  carreraId: number | null;
  titulo: string;
  campana: string;
  formato: string;
  descripcion: string;
  driveUrl: string;
  fechaPublicacion: string | null;
};

export type Autor = {
  tipo: "facultad" | "admin";
  nombre: string;
  email: string;
};

export async function listArtes(facultadId: number): Promise<Arte[]> {
  const rows = await db().sql`
    SELECT a.id, a.facultad_id, a.carrera_id, a.titulo, a.campana, a.formato,
      a.descripcion, a.drive_url, a.estado, a.version, a.created_at, a.updated_at,
      TO_CHAR(a.fecha_publicacion, 'YYYY-MM-DD') AS fecha_publicacion,
      c.nombre AS carrera_nombre
    FROM artes a
    LEFT JOIN carreras c ON c.id = a.carrera_id
    WHERE a.facultad_id = ${facultadId}
    ORDER BY
      CASE a.estado WHEN 'pendiente' THEN 0 WHEN 'cambios' THEN 1 ELSE 2 END,
      a.fecha_publicacion ASC NULLS LAST,
      a.updated_at DESC
  `;
  return rows as Arte[];
}

/**
 * Obtiene un arte. Si se pasa `facultadId`, solo lo devuelve cuando pertenece
 * a esa facultad (así el portal nunca expone artes de otra facultad).
 */
export async function getArte(id: number, facultadId?: number): Promise<Arte | null> {
  const rows = await db().sql`
    SELECT a.id, a.facultad_id, a.carrera_id, a.titulo, a.campana, a.formato,
      a.descripcion, a.drive_url, a.estado, a.version, a.created_at, a.updated_at,
      TO_CHAR(a.fecha_publicacion, 'YYYY-MM-DD') AS fecha_publicacion,
      c.nombre AS carrera_nombre
    FROM artes a
    LEFT JOIN carreras c ON c.id = a.carrera_id
    WHERE a.id = ${id}
  `;
  const arte = (rows[0] as Arte) ?? null;
  if (!arte) return null;
  if (facultadId !== undefined && arte.facultad_id !== facultadId) return null;
  return arte;
}

export async function createArte(facultadId: number, input: ArteInput): Promise<number> {
  const rows = await db().sql`
    INSERT INTO artes (facultad_id, carrera_id, titulo, campana, formato, descripcion, drive_url, fecha_publicacion)
    VALUES (${facultadId}, ${input.carreraId}, ${input.titulo}, ${input.campana}, ${input.formato},
      ${input.descripcion}, ${input.driveUrl}, ${input.fechaPublicacion})
    RETURNING id
  `;
  return (rows[0] as { id: number }).id;
}

/**
 * Actualiza los datos de un arte. Si cambia el enlace de Drive se considera
 * una nueva versión: sube el número de versión y vuelve a "pendiente".
 */
export async function updateArte(arte: Arte, input: ArteInput, autor: Autor) {
  const nuevaVersion = input.driveUrl !== arte.drive_url;
  const version = nuevaVersion ? arte.version + 1 : arte.version;
  const estado: EstadoArte = nuevaVersion ? "pendiente" : arte.estado;

  await db().sql`
    UPDATE artes SET
      carrera_id = ${input.carreraId},
      titulo = ${input.titulo},
      campana = ${input.campana},
      formato = ${input.formato},
      descripcion = ${input.descripcion},
      drive_url = ${input.driveUrl},
      fecha_publicacion = ${input.fechaPublicacion},
      version = ${version},
      estado = ${estado},
      updated_at = NOW()
    WHERE id = ${arte.id}
  `;
  if (nuevaVersion) {
    await addRevision(arte.id, version, "nueva_version", "", autor);
  }
}

export async function deleteArte(id: number) {
  await db().sql`DELETE FROM artes WHERE id = ${id}`;
}

export async function listRevisiones(arteId: number): Promise<Revision[]> {
  const rows = await db().sql`
    SELECT * FROM revisiones WHERE arte_id = ${arteId} ORDER BY created_at DESC, id DESC
  `;
  return rows as Revision[];
}

async function addRevision(
  arteId: number,
  version: number,
  accion: AccionRevision,
  comentario: string,
  autor: Autor
) {
  await db().sql`
    INSERT INTO revisiones (arte_id, accion, comentario, version, autor_tipo, autor_nombre, autor_email)
    VALUES (${arteId}, ${accion}, ${comentario}, ${version}, ${autor.tipo}, ${autor.nombre}, ${autor.email})
  `;
}

/**
 * Registra una decisión o comentario sobre la versión actual del arte.
 * "aprobado" y "cambios" cambian el estado; "comentario" no.
 */
export async function revisarArte(
  arte: Arte,
  accion: "aprobado" | "cambios" | "comentario",
  comentario: string,
  autor: Autor
) {
  if (accion !== "comentario") {
    await db().sql`
      UPDATE artes SET estado = ${accion}, updated_at = NOW() WHERE id = ${arte.id}
    `;
  }
  await addRevision(arte.id, arte.version, accion, comentario, autor);
}

export type ActividadReciente = Revision & {
  arte_titulo: string;
  facultad_id: number;
  facultad_nombre: string;
};

export async function listActividadReciente(limit = 15): Promise<ActividadReciente[]> {
  const rows = await db().sql`
    SELECT r.*, a.titulo AS arte_titulo, f.id AS facultad_id, f.nombre AS facultad_nombre
    FROM revisiones r
    JOIN artes a ON a.id = r.arte_id
    JOIN facultades f ON f.id = a.facultad_id
    WHERE r.autor_tipo = 'facultad'
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
  return rows as ActividadReciente[];
}
