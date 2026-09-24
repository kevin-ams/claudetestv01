import "server-only";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { imagePath, uploadsDir } from "./announcements";

export type Check = { name: string; ok: boolean; detail: string };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function check(name: string, fn: () => Promise<string>): Promise<Check> {
  try {
    return { name, ok: true, detail: await fn() };
  } catch (err) {
    return { name, ok: false, detail: message(err) };
  }
}

/** Pruebas rápidas para encontrar por qué algo no guarda o no carga. */
export async function runDiagnostics(teamId: number): Promise<Check[]> {
  const checks: Check[] = [];

  checks.push(
    await check("Base de datos: lectura", async () => {
      const rows = (await db().sql`SELECT COUNT(*)::int AS n FROM users`) as { n: number }[];
      return `OK (${rows[0].n} usuarios)`;
    })
  );

  checks.push(
    await check("Base de datos: escritura", async () => {
      const key = `__diagnostico_${Date.now()}`;
      await db().sql`INSERT INTO _migrations (name) VALUES (${key})`;
      const rows = await db().sql`SELECT 1 FROM _migrations WHERE name = ${key}`;
      await db().sql`DELETE FROM _migrations WHERE name = ${key}`;
      if (rows.length !== 1) throw new Error("Se escribió pero no se pudo leer de vuelta.");
      return "OK";
    })
  );

  checks.push(
    await check("Actualizaciones de la base (migraciones)", async () => {
      const files = (await readdir(path.join(process.cwd(), "db", "migrations"))).sort();
      const applied = new Set(
        ((await db().sql`SELECT name FROM _migrations`) as { name: string }[]).map((r) => r.name)
      );
      const missing = files.filter((f) => !applied.has(f));
      if (missing.length) throw new Error(`Faltan: ${missing.join(", ")}. Reinicia npm run dev para aplicarlas.`);
      return `OK (${files.length} aplicadas)`;
    })
  );

  checks.push(
    await check("Carpeta de imágenes: escritura", async () => {
      const dir = path.join(uploadsDir(), "anuncios");
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `.prueba-${Date.now()}`);
      await writeFile(file, "ok");
      const back = await readFile(file, "utf8");
      await rm(file, { force: true });
      if (back !== "ok") throw new Error("Se escribió pero no se pudo leer de vuelta.");
      return `OK (${dir})`;
    })
  );

  const slots = (await db().sql`
    SELECT slot, mime, active, updated_at FROM announcement_slots WHERE team_id = ${teamId} ORDER BY slot
  `.catch(() => [])) as { slot: number; mime: string | null; active: boolean }[];
  for (const s of slots.filter((x) => x.mime)) {
    checks.push(
      await check(`Anuncio espacio ${s.slot}`, async () => {
        const info = await stat(imagePath(teamId, s.slot)).catch(() => null);
        if (!info) throw new Error("Hay registro en la base pero falta el archivo de la imagen. Vuelve a subirla.");
        return `OK (${s.mime}, ${Math.round(info.size / 1024)} KB${s.active ? "" : ", pausado"})`;
      })
    );
  }

  checks.push({
    name: "Entorno",
    ok: true,
    detail: `Node ${process.version} · ${process.platform} · ${process.env.NODE_ENV} · carpeta ${process.cwd()}`,
  });
  return checks;
}
