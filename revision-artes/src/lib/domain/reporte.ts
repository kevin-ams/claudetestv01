import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { EstadoArte } from "./types";
import { marcasCampana, type MarcaChecklist } from "./checklist";

export type PuntoReporte = { id: number; numero: number; x: number; y: number; comentario: string; autor: string };
export type ComentarioReporte = { id: number; autor: string; comentario: string; fecha: string };

export type ArteReporte = {
  id: number;
  titulo: string;
  estado: EstadoArte;
  version: number;
  drive_url: string;
  formato: string;
  descripcion: string;
  fecha_publicacion: string | null;
  carrera: string | null;
  /** Puntos de la versión actual que siguen abiertos. */
  puntos: PuntoReporte[];
  /** Comentarios generales de "solicitar cambios" sobre la versión actual. */
  comentarios: ComentarioReporte[];
  /** Checklist de Diseño: item ('p:<id>' | 'c:<id>') → quién y cuándo lo marcó. */
  marcas: Record<string, MarcaChecklist>;
};

export type Reporte = {
  campana: { id: number; nombre: string; descripcion: string };
  facultad: { id: number; nombre: string };
  artes: ArteReporte[];
  totales: { artes: number; conCambios: number; puntos: number; hechos: number; requeridos: number };
};

/**
 * Reporte de cambios para Diseño: por cada arte de la campaña, lo que la
 * facultad pidió sobre la versión actual. Con `soloCambios` incluye solo los
 * artes en "cambios solicitados" (lo que Diseño tiene que trabajar).
 */
export async function reporteCampana(campanaId: number, soloCambios: boolean): Promise<Reporte | null> {
  const cab = (await db().sql`
    SELECT k.id, k.nombre, k.descripcion, f.id AS facultad_id, f.nombre AS facultad_nombre
    FROM campanas k JOIN facultades f ON f.id = k.facultad_id
    WHERE k.id = ${campanaId}
  `)[0] as
    | { id: number; nombre: string; descripcion: string; facultad_id: number; facultad_nombre: string }
    | undefined;
  if (!cab) return null;

  const artes = (await db().sql`
    SELECT a.id, a.titulo, a.estado, a.version, a.drive_url, a.formato, a.descripcion,
      TO_CHAR(a.fecha_publicacion, 'YYYY-MM-DD') AS fecha_publicacion, c.nombre AS carrera
    FROM artes a
    LEFT JOIN carreras c ON c.id = a.carrera_id
    WHERE a.campana_id = ${campanaId}
    ORDER BY CASE a.estado WHEN 'cambios' THEN 0 WHEN 'pendiente' THEN 1 ELSE 2 END,
      a.fecha_publicacion ASC NULLS LAST, a.titulo ASC
  `) as Omit<ArteReporte, "puntos" | "comentarios">[];

  const puntos = (await db().sql`
    SELECT n.id, n.arte_id, n.numero, n.x, n.y, n.comentario, r.autor_nombre AS autor
    FROM anotaciones n
    JOIN artes a ON a.id = n.arte_id AND n.version = a.version
    JOIN revisiones r ON r.id = n.revision_id
    WHERE a.campana_id = ${campanaId} AND NOT n.atendida
    ORDER BY n.numero ASC
  `) as (PuntoReporte & { arte_id: number })[];

  const comentarios = (await db().sql`
    SELECT r.id, r.arte_id, r.autor_nombre AS autor, r.comentario, r.created_at AS fecha
    FROM revisiones r
    JOIN artes a ON a.id = r.arte_id AND r.version = a.version
    WHERE a.campana_id = ${campanaId} AND r.accion = 'cambios' AND r.comentario <> ''
    ORDER BY r.created_at ASC
  `) as (ComentarioReporte & { arte_id: number })[];

  const marcas = await marcasCampana(campanaId);

  const completos: ArteReporte[] = artes
    .filter((a) => !soloCambios || a.estado === "cambios")
    .map((a) => ({
      ...a,
      puntos: puntos
        .filter((p) => p.arte_id === a.id)
        .map((p) => ({ id: p.id, numero: p.numero, x: Number(p.x), y: Number(p.y), comentario: p.comentario, autor: p.autor })),
      comentarios: comentarios
        .filter((c) => c.arte_id === a.id)
        .map((c) => ({ id: c.id, autor: c.autor, comentario: c.comentario, fecha: c.fecha })),
      marcas: marcas.get(a.id) ?? {},
    }));

  return {
    campana: { id: cab.id, nombre: cab.nombre, descripcion: cab.descripcion },
    facultad: { id: cab.facultad_id, nombre: cab.facultad_nombre },
    artes: completos,
    totales: {
      artes: artes.length,
      conCambios: artes.filter((a) => a.estado === "cambios").length,
      puntos: completos.reduce((n, a) => n + a.puntos.length, 0),
      requeridos: completos.reduce((n, a) => n + a.puntos.length + a.comentarios.length, 0),
      hechos: completos.reduce(
        (n, a) =>
          n +
          a.puntos.filter((p) => a.marcas[`p:${p.id}`]).length +
          a.comentarios.filter((c) => a.marcas[`c:${c.id}`]).length,
        0
      ),
    },
  };
}

export async function campanaPorToken(token: string): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const rows = await db().sql`SELECT id FROM campanas WHERE reporte_token = ${token}`;
  return (rows[0] as { id: number } | undefined)?.id ?? null;
}

export async function tokenReporte(campanaId: number): Promise<string | null> {
  const rows = await db().sql`SELECT reporte_token FROM campanas WHERE id = ${campanaId}`;
  return (rows[0] as { reporte_token: string | null } | undefined)?.reporte_token ?? null;
}

/** Devuelve el enlace activo de la campaña o crea uno nuevo. */
export async function asegurarTokenReporte(campanaId: number): Promise<string> {
  const actual = await tokenReporte(campanaId);
  if (actual) return actual;
  const token = randomBytes(24).toString("base64url");
  await db().sql`UPDATE campanas SET reporte_token = ${token} WHERE id = ${campanaId}`;
  return token;
}

export async function revocarTokenReporte(campanaId: number) {
  await db().sql`UPDATE campanas SET reporte_token = NULL WHERE id = ${campanaId}`;
}
