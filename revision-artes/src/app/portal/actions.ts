"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { endPortalSession, requirePortal, startPortalSession } from "@/lib/auth/session";
import { getFacultadByCodigo } from "@/lib/domain/facultades";
import { getArte, revisarArte } from "@/lib/domain/artes";
import { avisarCampanaRevisada } from "@/lib/notificaciones";
import { estadoCampana } from "@/lib/domain/campanas";
import {
  borrarBorrador,
  borrarBorradoresDe,
  guardarBorrador,
  leerBorrador,
  type PuntoBorrador,
} from "@/lib/domain/borradores";

export type FormState = { error: string | null; ok?: boolean; celebrar?: boolean };

const ingresoSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  codigo: z.string().trim().min(4, "Escribe el código de acceso de tu facultad"),
});

export async function ingresarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ingresoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const facultad = await getFacultadByCodigo(parsed.data.codigo);
  if (!facultad || !facultad.activa) {
    return { error: "El código de acceso no es válido. Pídelo al equipo de Marketing Digital." };
  }

  await startPortalSession({
    facultadId: facultad.id,
    codigo: facultad.codigo_acceso,
    name: parsed.data.name,
    email: parsed.data.email,
  });
  redirect(destinoSeguro(formData.get("next")));
}

/** Solo permite volver a páginas del propio portal (evita redirecciones abiertas). */
function destinoSeguro(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return /^\/portal(\/[\w-]+)*$/.test(next) ? next : "/portal";
}

export async function salirAction() {
  await endPortalSession();
  redirect("/portal/ingresar");
}

const puntoSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  comentario: z.string().trim().min(1, "Escribe qué hay que cambiar en cada punto marcado").max(1000),
});

const revisionSchema = z
  .object({
    accion: z.enum(["aprobado", "cambios", "comentario"]),
    comentario: z.string().trim().max(5000),
    puntos: z.array(puntoSchema).max(50, "Máximo 50 puntos por revisión"),
  })
  .refine((v) => v.accion !== "aprobado" || v.puntos.length === 0, {
    message: "Tienes puntos marcados en la imagen: usa “Solicitar cambios” o elimínalos para aprobar",
  })
  .refine((v) => v.accion === "aprobado" || v.comentario.length > 0 || v.puntos.length > 0, {
    message: "Describe los cambios o marca puntos sobre la imagen",
  });

function leerPuntos(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function revisarArteAction(
  arteId: number,
  version: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { session, facultad } = await requirePortal();
  const parsed = revisionSchema.safeParse({
    accion: formData.get("accion"),
    comentario: formData.get("comentario") ?? "",
    puntos: leerPuntos(formData.get("puntos")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  // Solo artes de la facultad con la que se ingresó.
  const arte = await getArte(arteId, facultad.id);
  if (!arte) return { error: "El arte no existe" };
  // Si Marketing Digital subió otra versión mientras se revisaba, no mezclar.
  if (arte.version !== version) {
    return { error: "Se subió una nueva versión de este arte mientras revisabas. Recarga la página." };
  }

  await revisarArte(arte, parsed.data.accion, parsed.data.comentario, parsed.data.puntos, {
    tipo: "facultad",
    nombre: session.name,
    email: session.email,
  });
  // Los puntos guardados como borrador ya forman parte de la revisión.
  await borrarBorradoresDe(arte.id, arte.version, session.email);

  // Si con esta decisión ya no quedan artes pendientes en la campaña, avisar a
  // quien la creó. Solo cuando este arte estaba pendiente (así no se repite
  // el aviso si cambian una decisión ya tomada). Se envía después de responder.
  const campanaId = arte.campana_id;
  if (campanaId && arte.estado === "pendiente" && parsed.data.accion !== "comentario") {
    after(() =>
      avisarCampanaRevisada(campanaId, { nombre: session.name, email: session.email }).catch((e) =>
        console.error("[aviso campaña revisada]", e)
      )
    );
  }
  // ¿Con esta aprobación quedó toda la campaña aprobada? → confeti en pantalla.
  let celebrar = false;
  if (campanaId && parsed.data.accion === "aprobado") {
    const e = await estadoCampana(campanaId);
    celebrar = e.total > 0 && e.aprobados === e.total;
  }
  revalidatePath(`/portal/artes/${arteId}`);
  revalidatePath("/portal", "layout");
  return { error: null, ok: true, celebrar };
}

// ---------- Puntos guardados al pulsar "Listo" ----------

const borradorSchema = z.object({
  id: z.number().int().positive().optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  comentario: z.string().trim().min(1, "Escribe qué hay que cambiar en este punto").max(1000),
});

export type ResultadoPunto = { ok: boolean; error?: string; punto?: PuntoBorrador };

/**
 * Guarda un punto marcado (sin enviar todavía la revisión) y lo vuelve a leer
 * de la base para confirmar que quedó guardado tal cual.
 */
export async function guardarPuntoAction(
  arteId: number,
  version: number,
  input: { id?: number; x: number; y: number; comentario: string }
): Promise<ResultadoPunto> {
  const { session, facultad } = await requirePortal();
  const parsed = borradorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const arte = await getArte(arteId, facultad.id);
  if (!arte) return { ok: false, error: "El arte no existe" };
  if (arte.version !== version) {
    return { ok: false, error: "Se subió una nueva versión de este arte. Recarga la página." };
  }
  const guardado = await guardarBorrador({ ...parsed.data, arteId, version, email: session.email });
  if (!guardado) return { ok: false, error: "No se encontró el punto para actualizarlo. Recarga la página." };
  // Verificación: se lee de nuevo y se compara con lo enviado.
  const leido = await leerBorrador(guardado.id, session.email);
  const igual =
    leido !== null &&
    leido.comentario === parsed.data.comentario &&
    Math.abs(leido.x - parsed.data.x) < 0.01 &&
    Math.abs(leido.y - parsed.data.y) < 0.01;
  if (!igual) return { ok: false, error: "No se pudo confirmar el guardado. Intenta de nuevo." };
  return { ok: true, punto: leido };
}

export async function quitarPuntoAction(arteId: number, id: number): Promise<{ ok: boolean }> {
  const { session, facultad } = await requirePortal();
  const arte = await getArte(arteId, facultad.id);
  if (!arte) return { ok: false };
  await borrarBorrador(id, arteId, session.email);
  return { ok: true };
}
