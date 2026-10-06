import "server-only";
import { db } from "@/lib/db";
import type { AccionRevision, EstadoArte } from "./types";

export type Arte = {
  id: number;
  facultad_id: number;
  carrera_id: number | null;
  carrera_nombre: string | null;
  campana_id: number | null;
  campana_nombre: string | null;
  titulo: string;
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

export type Version = {
  version: number;
  drive_url: string;
  nota: string;
  created_at: string;
};

/** Punto marcado sobre la imagen. x / y en porcentaje (0–100). */
export type Anotacion = {
  id: number;
  revision_id: number;
  version: number;
  numero: number;
  x: number;
  y: number;
  comentario: string;
  atendida: boolean;
  autor_nombre: string;
  created_at: string;
};

export type PuntoNuevo = { x: number; y: number; comentario: string };

export type ArteDatos = {
  carreraId: number | null;
  campanaId: number | null;
  titulo: string;
  formato: string;
  descripcion: string;
  fechaPublicacion: string | null;
};

export type Autor = {
  tipo: "facultad" | "admin";
  nombre: string;
  email: string;
};

export async function listArtes(facultadId: number): Promise<Arte[]> {
  const rows = await db().sql`
    SELECT a.id, a.facultad_id, a.carrera_id, a.campana_id, a.titulo, a.formato,
      a.descripcion, a.drive_url, a.estado, a.version, a.created_at, a.updated_at,
      TO_CHAR(a.fecha_publicacion, 'YYYY-MM-DD') AS fecha_publicacion,
      c.nombre AS carrera_nombre, k.nombre AS campana_nombre
    FROM artes a
    LEFT JOIN carreras c ON c.id = a.carrera_id
    LEFT JOIN campanas k ON k.id = a.campana_id
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
    SELECT a.id, a.facultad_id, a.carrera_id, a.campana_id, a.titulo, a.formato,
      a.descripcion, a.drive_url, a.estado, a.version, a.created_at, a.updated_at,
      TO_CHAR(a.fecha_publicacion, 'YYYY-MM-DD') AS fecha_publicacion,
      c.nombre AS carrera_nombre, k.nombre AS campana_nombre
    FROM artes a
    LEFT JOIN carreras c ON c.id = a.carrera_id
    LEFT JOIN campanas k ON k.id = a.campana_id
    WHERE a.id = ${id}
  `;
  const arte = (rows[0] as Arte) ?? null;
  if (!arte) return null;
  if (facultadId !== undefined && arte.facultad_id !== facultadId) return null;
  return arte;
}

export async function createArte(
  facultadId: number,
  datos: ArteDatos,
  driveUrl: string
): Promise<number> {
  const rows = await db().sql`
    WITH a AS (
      INSERT INTO artes (facultad_id, carrera_id, campana_id, titulo, formato, descripcion, drive_url, fecha_publicacion)
      VALUES (${facultadId}, ${datos.carreraId}, ${datos.campanaId}, ${datos.titulo}, ${datos.formato},
        ${datos.descripcion}, ${driveUrl}, ${datos.fechaPublicacion})
      RETURNING id, drive_url
    ), v AS (
      INSERT INTO arte_versiones (arte_id, version, drive_url)
      SELECT id, 1, drive_url FROM a
    )
    SELECT id FROM a
  `;
  return (rows[0] as { id: number }).id;
}

/** Edita los datos descriptivos. El enlace solo cambia con una nueva versión. */
export async function updateArte(arteId: number, datos: ArteDatos) {
  await db().sql`
    UPDATE artes SET
      carrera_id = ${datos.carreraId},
      titulo = ${datos.titulo},
      campana_id = ${datos.campanaId},
      formato = ${datos.formato},
      descripcion = ${datos.descripcion},
      fecha_publicacion = ${datos.fechaPublicacion},
      updated_at = NOW()
    WHERE id = ${arteId}
  `;
}

/**
 * Sube una nueva versión con los cambios solicitados: guarda el nuevo enlace,
 * marca como atendidos los puntos indicados de la versión anterior, deja el
 * arte en "pendiente" y lo registra en el historial. Todo en una sola sentencia.
 */
export async function crearNuevaVersion(
  arte: Arte,
  input: { driveUrl: string; nota: string; atendidas: number[] },
  autor: Autor
) {
  const version = arte.version + 1;
  await db().sql`
    WITH u AS (
      UPDATE artes SET drive_url = ${input.driveUrl}, version = ${version},
        estado = 'pendiente', updated_at = NOW()
      WHERE id = ${arte.id} AND version = ${arte.version}
      RETURNING id
    ), v AS (
      INSERT INTO arte_versiones (arte_id, version, drive_url, nota)
      SELECT id, ${version}, ${input.driveUrl}, ${input.nota} FROM u
    ), p AS (
      UPDATE anotaciones SET atendida = TRUE
      WHERE arte_id IN (SELECT id FROM u) AND version = ${arte.version}
        AND id = ANY(${input.atendidas}::int[])
    )
    INSERT INTO revisiones (arte_id, accion, comentario, version, autor_tipo, autor_nombre, autor_email)
    SELECT id, 'nueva_version', ${input.nota}, ${version}, ${autor.tipo}, ${autor.nombre}, ${autor.email}
    FROM u
  `;
}

export async function deleteArte(id: number) {
  await db().sql`DELETE FROM artes WHERE id = ${id}`;
}

export async function listVersiones(arteId: number): Promise<Version[]> {
  const rows = await db().sql`
    SELECT version, drive_url, nota, created_at FROM arte_versiones
    WHERE arte_id = ${arteId} ORDER BY version DESC
  `;
  return rows as Version[];
}

export async function listRevisiones(arteId: number): Promise<Revision[]> {
  const rows = await db().sql`
    SELECT * FROM revisiones WHERE arte_id = ${arteId} ORDER BY created_at DESC, id DESC
  `;
  return rows as Revision[];
}

export async function listAnotaciones(arteId: number): Promise<Anotacion[]> {
  const rows = await db().sql`
    SELECT n.id, n.revision_id, n.version, n.numero, n.x, n.y, n.comentario,
      n.atendida, n.created_at, r.autor_nombre
    FROM anotaciones n
    JOIN revisiones r ON r.id = n.revision_id
    WHERE n.arte_id = ${arteId}
    ORDER BY n.version DESC, n.numero ASC
  `;
  return (rows as Anotacion[]).map((a) => ({ ...a, x: Number(a.x), y: Number(a.y) }));
}

/**
 * Registra una decisión o comentario sobre la versión actual del arte, con
 * los puntos marcados en la imagen (numerados a continuación de los que ya
 * existen en esa versión). "aprobado" y "cambios" cambian el estado.
 */
export async function revisarArte(
  arte: Arte,
  accion: "aprobado" | "cambios" | "comentario",
  comentario: string,
  puntos: PuntoNuevo[],
  autor: Autor
) {
  const estado = accion === "comentario" ? null : accion;
  await db().sql`
    WITH u AS (
      UPDATE artes SET estado = COALESCE(${estado}, estado), updated_at = NOW()
      WHERE id = ${arte.id}
      RETURNING id
    ), r AS (
      INSERT INTO revisiones (arte_id, accion, comentario, version, autor_tipo, autor_nombre, autor_email)
      SELECT id, ${accion}, ${comentario}, ${arte.version}, ${autor.tipo}, ${autor.nombre}, ${autor.email}
      FROM u
      RETURNING id
    ), base AS (
      SELECT COALESCE(MAX(numero), 0) AS n FROM anotaciones
      WHERE arte_id = ${arte.id} AND version = ${arte.version}
    )
    INSERT INTO anotaciones (arte_id, revision_id, version, numero, x, y, comentario)
    SELECT ${arte.id}, r.id, ${arte.version}, base.n + p.ord,
      (p.val->>'x')::real, (p.val->>'y')::real, p.val->>'comentario'
    FROM r, base, jsonb_array_elements(${JSON.stringify(puntos)}::jsonb) WITH ORDINALITY AS p(val, ord)
  `;
}

/** Persona de facultad que revisó el arte (destinataria de los avisos). */
export type Revisor = {
  nombre: string;
  email: string;
  /** Pidió cambios o comentó (no solo aprobó). */
  comento: boolean;
};

export async function listRevisores(arteId: number): Promise<Revisor[]> {
  const rows = await db().sql`
    SELECT LOWER(autor_email) AS email,
      (ARRAY_AGG(autor_nombre ORDER BY created_at DESC))[1] AS nombre,
      BOOL_OR(accion IN ('cambios', 'comentario')) AS comento
    FROM revisiones
    WHERE arte_id = ${arteId} AND autor_tipo = 'facultad'
    GROUP BY LOWER(autor_email)
    ORDER BY nombre ASC
  `;
  return rows as Revisor[];
}

export async function registrarNotificacion(arte: Arte, emails: string[], autor: Autor) {
  await db().sql`
    INSERT INTO revisiones (arte_id, accion, comentario, version, autor_tipo, autor_nombre, autor_email)
    VALUES (${arte.id}, 'notificacion', ${"Aviso enviado a: " + emails.join(", ")}, ${arte.version},
      ${autor.tipo}, ${autor.nombre}, ${autor.email})
  `;
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
