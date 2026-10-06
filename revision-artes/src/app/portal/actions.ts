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
  redirect("/portal");
}

export async function salirAction() {
  await endPortalSession();
  redirect("/portal/ingresar");
}

const revisionSchema = z
  .object({
    accion: z.enum(["aprobado", "cambios", "comentario"]),
    comentario: z.string().trim().max(5000),
  })
  .refine((v) => v.accion === "aprobado" || v.comentario.length > 0, {
    message: "Describe los cambios o tu comentario",
  });

export async function revisarArteAction(
  arteId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { session, facultad } = await requirePortal();
  const parsed = revisionSchema.safeParse({
    accion: formData.get("accion"),
    comentario: formData.get("comentario") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  // Solo artes de la facultad con la que se ingresó.
  const arte = await getArte(arteId, facultad.id);
  if (!arte) return { error: "El arte no existe" };

  await revisarArte(arte, parsed.data.accion, parsed.data.comentario, {
    tipo: "facultad",
    nombre: session.name,
    email: session.email,
  });
  revalidatePath(`/portal/artes/${arteId}`);
  revalidatePath("/portal");
  return { error: null, ok: true };
}
