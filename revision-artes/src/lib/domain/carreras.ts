import "server-only";
import { db } from "@/lib/db";

export type Carrera = {
  id: number;
  facultad_id: number;
  nombre: string;
  created_at: string;
};

export async function listCarreras(facultadId: number): Promise<Carrera[]> {
  const rows = await db().sql`
    SELECT * FROM carreras WHERE facultad_id = ${facultadId} ORDER BY nombre ASC
  `;
  return rows as Carrera[];
}

export async function getCarrera(id: number): Promise<Carrera | null> {
  const rows = await db().sql`SELECT * FROM carreras WHERE id = ${id}`;
  return (rows[0] as Carrera) ?? null;
}

export async function createCarrera(facultadId: number, nombre: string) {
  await db().sql`
    INSERT INTO carreras (facultad_id, nombre) VALUES (${facultadId}, ${nombre})
  `;
}

export async function renameCarrera(id: number, nombre: string) {
  await db().sql`UPDATE carreras SET nombre = ${nombre} WHERE id = ${id}`;
}

export async function deleteCarrera(id: number) {
  await db().sql`DELETE FROM carreras WHERE id = ${id}`;
}
