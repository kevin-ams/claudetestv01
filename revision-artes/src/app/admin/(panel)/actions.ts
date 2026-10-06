"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { parseDriveUrl } from "@/lib/drive";
import {
  createFacultad,
  deleteFacultad,
  getFacultad,
  regenerarCodigo,
  updateFacultad,
} from "@/lib/domain/facultades";
import { createCarrera, deleteCarrera, getCarrera, renameCarrera } from "@/lib/domain/carreras";
import {
  createArte,
  crearNuevaVersion,
  deleteArte,
  getArte,
  listRevisores,
  revisarArte,
  updateArte,
  type ArteDatos,
} from "@/lib/domain/artes";
import { countAdmins, createAdmin, deleteAdmin, getAdminByEmail } from "@/lib/domain/admins";
import { notificarNuevaVersion } from "@/lib/notificaciones";
import type { FormState } from "../auth-actions";

const nombre = z.string().trim().min(2, "El nombre es muy corto").max(200);

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Datos inválidos";
}

// ---------- Facultades ----------

export async function createFacultadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = nombre.safeParse(formData.get("nombre"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const facultad = await createFacultad(parsed.data);
  redirect(`/admin/facultades/${facultad.id}`);
}

export async function updateFacultadAction(
  facultadId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = nombre.safeParse(formData.get("nombre"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await updateFacultad(facultadId, {
    nombre: parsed.data,
    activa: formData.get("activa") === "on",
  });
  revalidatePath("/admin", "layout");
  return { error: null, ok: true };
}

export async function regenerarCodigoAction(facultadId: number) {
  await requireAdmin();
  await regenerarCodigo(facultadId);
  revalidatePath(`/admin/facultades/${facultadId}`);
}

export async function deleteFacultadAction(facultadId: number) {
  await requireAdmin();
  await deleteFacultad(facultadId);
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

// ---------- Carreras ----------

export async function createCarreraAction(
  facultadId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = nombre.safeParse(formData.get("nombre"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await getFacultad(facultadId))) return { error: "La facultad no existe" };
  await createCarrera(facultadId, parsed.data);
  revalidatePath(`/admin/facultades/${facultadId}`);
  return { error: null, ok: true };
}

export async function renameCarreraAction(carreraId: number, formData: FormData) {
  await requireAdmin();
  const parsed = nombre.safeParse(formData.get("nombre"));
  const carrera = await getCarrera(carreraId);
  if (!parsed.success || !carrera) return;
  await renameCarrera(carreraId, parsed.data);
  revalidatePath(`/admin/facultades/${carrera.facultad_id}`);
}

export async function deleteCarreraAction(carreraId: number) {
  await requireAdmin();
  const carrera = await getCarrera(carreraId);
  if (!carrera) return;
  await deleteCarrera(carreraId);
  revalidatePath(`/admin/facultades/${carrera.facultad_id}`);
}

// ---------- Artes ----------

const driveUrl = z
  .string()
  .trim()
  .refine((v) => parseDriveUrl(v) !== null, "Pega un enlace válido de Google Drive (archivo o carpeta)");

const datosSchema = z.object({
  titulo: z.string().trim().min(2, "El título es muy corto").max(200),
  campana: z.string().trim().max(200),
  formato: z.string().trim().max(100),
  descripcion: z.string().trim().max(5000),
  fechaPublicacion: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida"),
  carreraId: z.string(),
});

/** Valida los datos del arte y que la carrera elegida pertenezca a la facultad. */
async function parseDatos(
  facultadId: number,
  formData: FormData
): Promise<{ data: ArteDatos } | { error: string }> {
  const parsed = datosSchema.safeParse({
    titulo: formData.get("titulo") ?? "",
    campana: formData.get("campana") ?? "",
    formato: formData.get("formato") ?? "",
    descripcion: formData.get("descripcion") ?? "",
    fechaPublicacion: formData.get("fechaPublicacion") ?? "",
    carreraId: formData.get("carreraId") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let carreraId: number | null = null;
  const rawCarrera = parsed.data.carreraId;
  if (rawCarrera && rawCarrera !== "general") {
    const carrera = await getCarrera(Number(rawCarrera));
    if (!carrera || carrera.facultad_id !== facultadId) {
      return { error: "La carrera no pertenece a esta facultad" };
    }
    carreraId = carrera.id;
  }

  return {
    data: {
      carreraId,
      titulo: parsed.data.titulo,
      campana: parsed.data.campana,
      formato: parsed.data.formato,
      descripcion: parsed.data.descripcion,
      fechaPublicacion: parsed.data.fechaPublicacion || null,
    },
  };
}

export async function createArteAction(
  facultadId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  if (!(await getFacultad(facultadId))) return { error: "La facultad no existe" };
  const result = await parseDatos(facultadId, formData);
  if ("error" in result) return { error: result.error };
  const url = driveUrl.safeParse(formData.get("driveUrl") ?? "");
  if (!url.success) return { error: firstError(url.error) };
  const id = await createArte(facultadId, result.data, url.data);
  revalidatePath(`/admin/facultades/${facultadId}`);
  redirect(`/admin/artes/${id}`);
}

export async function updateArteAction(
  arteId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const arte = await getArte(arteId);
  if (!arte) return { error: "El arte no existe" };
  const result = await parseDatos(arte.facultad_id, formData);
  if ("error" in result) return { error: result.error };
  await updateArte(arte.id, result.data);
  revalidatePath(`/admin/artes/${arteId}`);
  revalidatePath(`/admin/facultades/${arte.facultad_id}`);
  return { error: null, ok: true };
}

const nuevaVersionSchema = z.object({
  driveUrl,
  nota: z.string().trim().min(3, "Describe qué cambiaste en esta versión").max(5000),
  atendidas: z.array(z.coerce.number().int().positive()).max(200),
});

export async function nuevaVersionAction(
  arteId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const arte = await getArte(arteId);
  if (!arte) return { error: "El arte no existe" };
  const parsed = nuevaVersionSchema.safeParse({
    driveUrl: formData.get("driveUrl") ?? "",
    nota: formData.get("nota") ?? "",
    atendidas: formData.getAll("atendidas"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.driveUrl === arte.drive_url) {
    return { error: "El enlace es el mismo de la versión actual. Pega el enlace del archivo corregido." };
  }
  const autor = { tipo: "admin" as const, nombre: admin.name, email: admin.email };
  await crearNuevaVersion(arte, parsed.data, autor);
  revalidatePath(`/admin/artes/${arteId}`);
  revalidatePath(`/admin/facultades/${arte.facultad_id}`);
  revalidatePath(`/portal/artes/${arteId}`);

  const elegidos = await revisoresElegidos(arte.id, formData);
  if (elegidos.length === 0) {
    return { error: null, ok: true, message: `v${arte.version + 1} publicada. No se envió aviso por correo.` };
  }
  const actualizado = await getArte(arte.id);
  const aviso = await notificarNuevaVersion(actualizado!, elegidos, autor);
  return aviso.ok
    ? { error: null, ok: true, message: `v${arte.version + 1} publicada. ${aviso.message}` }
    : { error: `v${arte.version + 1} publicada, pero el aviso no se envió: ${aviso.message}` };
}

/** Destinatarios marcados en el formulario, solo entre quienes revisaron este arte. */
async function revisoresElegidos(arteId: number, formData: FormData) {
  const marcados = new Set(formData.getAll("notificar").map((v) => String(v).toLowerCase()));
  return (await listRevisores(arteId)).filter((r) => marcados.has(r.email));
}

export async function notificarAction(
  arteId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const arte = await getArte(arteId);
  if (!arte) return { error: "El arte no existe" };
  const elegidos = await revisoresElegidos(arte.id, formData);
  if (elegidos.length === 0) return { error: "Elige al menos una persona para notificar." };
  const aviso = await notificarNuevaVersion(arte, elegidos, { tipo: "admin", nombre: admin.name, email: admin.email });
  revalidatePath(`/admin/artes/${arteId}`);
  return aviso.ok ? { error: null, ok: true, message: aviso.message } : { error: aviso.message };
}

export async function comentarArteAction(
  arteId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const arte = await getArte(arteId);
  if (!arte) return { error: "El arte no existe" };
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 5000);
  if (!comentario) return { error: "Escribe un comentario" };
  await revisarArte(arte, "comentario", comentario, [], {
    tipo: "admin",
    nombre: admin.name,
    email: admin.email,
  });
  revalidatePath(`/admin/artes/${arteId}`);
  return { error: null, ok: true };
}

export async function deleteArteAction(arteId: number) {
  await requireAdmin();
  const arte = await getArte(arteId);
  if (!arte) return;
  await deleteArte(arteId);
  revalidatePath(`/admin/facultades/${arte.facultad_id}`);
  redirect(`/admin/facultades/${arte.facultad_id}`);
}

// ---------- Administradores ----------

const adminSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function createAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = adminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await getAdminByEmail(parsed.data.email)) {
    return { error: "Ya existe un administrador con ese correo" };
  }
  await createAdmin(parsed.data);
  revalidatePath("/admin/administradores");
  return { error: null, ok: true };
}

export async function deleteAdminAction(adminId: number) {
  const session = await requireAdmin();
  if (adminId === session.adminId) return;
  if ((await countAdmins()) <= 1) return;
  await deleteAdmin(adminId);
  revalidatePath("/admin/administradores");
}
