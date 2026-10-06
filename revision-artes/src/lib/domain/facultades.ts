import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";

export type Facultad = {
  id: number;
  nombre: string;
  codigo_acceso: string;
  activa: boolean;
  created_at: string;
};

export type FacultadResumen = Facultad & {
  carreras: number;
  pendientes: number;
  aprobados: number;
  cambios: number;
};

// Sin caracteres ambiguos (0/O, 1/I/L) para que se pueda dictar o copiar a mano.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generarCodigo(): string {
  let out = "";
  for (let i = 0; i < 10; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function normalizarCodigo(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{5})(.+)$/, "$1-$2");
}

export async function getFacultad(id: number): Promise<Facultad | null> {
  const rows = await db().sql`SELECT * FROM facultades WHERE id = ${id}`;
  return (rows[0] as Facultad) ?? null;
}

export async function getFacultadByCodigo(codigo: string): Promise<Facultad | null> {
  const rows = await db().sql`
    SELECT * FROM facultades WHERE codigo_acceso = ${normalizarCodigo(codigo)}
  `;
  return (rows[0] as Facultad) ?? null;
}

export async function listFacultadesResumen(): Promise<FacultadResumen[]> {
  const rows = await db().sql`
    SELECT f.*,
      (SELECT COUNT(*)::int FROM carreras c WHERE c.facultad_id = f.id) AS carreras,
      (SELECT COUNT(*)::int FROM artes a WHERE a.facultad_id = f.id AND a.estado = 'pendiente') AS pendientes,
      (SELECT COUNT(*)::int FROM artes a WHERE a.facultad_id = f.id AND a.estado = 'aprobado') AS aprobados,
      (SELECT COUNT(*)::int FROM artes a WHERE a.facultad_id = f.id AND a.estado = 'cambios') AS cambios
    FROM facultades f
    ORDER BY f.nombre ASC
  `;
  return rows as FacultadResumen[];
}

export async function createFacultad(nombre: string): Promise<Facultad> {
  const rows = await db().sql`
    INSERT INTO facultades (nombre, codigo_acceso)
    VALUES (${nombre}, ${generarCodigo()})
    RETURNING *
  `;
  return rows[0] as Facultad;
}

export async function updateFacultad(id: number, input: { nombre: string; activa: boolean }) {
  await db().sql`
    UPDATE facultades SET nombre = ${input.nombre}, activa = ${input.activa}
    WHERE id = ${id}
  `;
}

export async function regenerarCodigo(id: number) {
  await db().sql`
    UPDATE facultades SET codigo_acceso = ${generarCodigo()} WHERE id = ${id}
  `;
}

export async function deleteFacultad(id: number) {
  await db().sql`DELETE FROM facultades WHERE id = ${id}`;
}
