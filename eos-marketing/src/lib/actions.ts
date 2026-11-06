import "server-only";
import { z } from "zod";

// Utilidades comunes de las server actions: validación con zod, resultado uniforme y errores.
// Patrón de cada acción:  permiso (requireModule) → validar (parse) → dominio (siempre con teamId) → revalidar.

/** Resultado estándar de las acciones que informan algo a la pantalla. */
export type ActionResult = { ok: boolean; message: string };

/** Error de datos de entrada (se muestra tal cual a la persona). */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

/** Valida la entrada con un esquema zod; si falla, lanza InvalidInputError con el primer mensaje. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new InvalidInputError(r.error.issues[0]?.message || "Datos inválidos.");
  return r.data;
}

/** FormData → objeto plano (para validarlo con zod). */
export const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

/** Mensaje para la persona a partir de un error (permisos y validación se muestran; lo demás, genérico). */
export function errorMessage(e: unknown, fallback: string, scope: string): string {
  if (e instanceof Error && (e.name === "AccessDeniedError" || e.name === "InvalidInputError")) return e.message;
  console.error(`[${scope}]`, e);
  return fallback;
}

/** Ejecuta una acción y devuelve siempre ActionResult (nunca lanza). */
export async function safeAction(scope: string, fallback: string, fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, message: errorMessage(e, fallback, scope) };
  }
}

/** Registro no encontrado o de otro equipo (mismo mensaje en ambos casos: no revela si existe). */
export const NOT_FOUND: ActionResult = { ok: false, message: "No se encontró (o no es de tu equipo)." };

// --- Esquemas comunes -------------------------------------------------------------------

export const zId = z.coerce.number({ message: "Id inválido." }).int().positive("Id inválido.");
export const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD).");
/** Fecha opcional: "" o null → null. */
export const zOptDate = z
  .union([zIsoDate, z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v ? v : null));
export const zTitle = (max = 300) => z.string({ message: "Escribe un título." }).trim().min(1, "Escribe un título.").max(max, `Máximo ${max} caracteres.`);
export const zText = (max = 5000) => z.string().trim().max(max, `Máximo ${max} caracteres.`).default("");
/** Persona opcional en formularios ("none" o vacío → null). */
export const zOwner = z
  .union([z.literal("none"), z.literal(""), z.null(), z.undefined(), z.coerce.number().int().positive()])
  .transform((v) => (typeof v === "number" ? v : null));
export const zCheckbox = z.union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined(), z.null()]).transform((v) => v === "on" || v === "true");
