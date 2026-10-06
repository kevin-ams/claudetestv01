"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endPortalSession, requirePortal, startPortalSession } from "@/lib/auth/session";
import { getFacultadByCodigo } from "@/lib/domain/facultades";
import { getArte, revisarArte } from "@/lib/domain/artes";

export type FormState = { error: string | null; ok?: boolean };

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
    return { error: "El código de acceso no es válido. Pídelo al equipo de comunicación." };
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
  // Si comunicación subió otra versión mientras se revisaba, no mezclar.
  if (arte.version !== version) {
    return { error: "Se subió una nueva versión de este arte mientras revisabas. Recarga la página." };
  }

  await revisarArte(arte, parsed.data.accion, parsed.data.comentario, parsed.data.puntos, {
    tipo: "facultad",
    nombre: session.name,
    email: session.email,
  });
  revalidatePath(`/portal/artes/${arteId}`);
  revalidatePath("/portal");
  return { error: null, ok: true };
}
