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
import { createCampana, deleteCampana, getCampana, updateCampana } from "@/lib/domain/campanas";
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
import { appUrl, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { asegurarTokenReporte, reporteCampana, revocarTokenReporte } from "@/lib/domain/reporte";
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

// ---------- Campañas ----------

const campanaSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre de la campaña es muy corto").max(200),
  descripcion: z.string().trim().max(2000),
});

function leerCampana(formData: FormData) {
  return campanaSchema.safeParse({
    nombre: formData.get("nombre") ?? "",
    descripcion: formData.get("descripcion") ?? "",
  });
}

export async function createCampanaAction(
  facultadId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await getFacultad(facultadId))) return { error: "La facultad no existe" };
  const parsed = leerCampana(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = await createCampana(facultadId, parsed.data.nombre, parsed.data.descripcion, {
    nombre: admin.name,
    email: admin.email,
  });
  revalidatePath(`/admin/facultades/${facultadId}`);
  redirect(`/admin/facultades/${facultadId}/campanas/${id}`);
}

export async function updateCampanaAction(
  campanaId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const campana = await getCampana(campanaId);
  if (!campana) return { error: "La campaña no existe" };
  const parsed = leerCampana(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  await updateCampana(campana.id, parsed.data.nombre, parsed.data.descripcion);
  revalidatePath(`/admin/facultades/${campana.facultad_id}`, "layout");
  return { error: null, ok: true, message: "Campaña guardada" };
}

export async function deleteCampanaAction(campanaId: number) {
  await requireAdmin();
  const campana = await getCampana(campanaId);
  if (!campana) return;
  await deleteCampana(campana.id);
  revalidatePath(`/admin/facultades/${campana.facultad_id}`);
  redirect(`/admin/facultades/${campana.facultad_id}`);
}

// ---------- Artes ----------

const driveUrl = z
  .string()
  .trim()
  .refine((v) => parseDriveUrl(v) !== null, "Pega un enlace válido de Google Drive (archivo o carpeta)");

const datosSchema = z.object({
  titulo: z.string().trim().min(2, "El título es muy corto").max(200),
  campanaId: z.string(),
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
    campanaId: formData.get("campanaId") ?? "",
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

  let campanaId: number | null = null;
  const rawCampana = parsed.data.campanaId;
  if (rawCampana && rawCampana !== "ninguna") {
    const campana = await getCampana(Number(rawCampana), facultadId);
    if (!campana) return { error: "La campaña no pertenece a esta facultad" };
    campanaId = campana.id;
  }

  return {
    data: {
      carreraId,
      titulo: parsed.data.titulo,
      campanaId,
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
  revalidatePath(`/admin/facultades/${facultadId}`, "layout");
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
  revalidatePath(`/admin/facultades/${arte.facultad_id}`, "layout");
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
  revalidatePath(`/admin/facultades/${arte.facultad_id}`, "layout");
  redirect(`/admin/facultades/${arte.facultad_id}/campanas/${arte.campana_id ?? "otros"}`);
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

// ---------- Correo ----------

/** Envía un correo de prueba al admin que lo pide, para comprobar la conexión con Resend. */
export async function correoPruebaAction(): Promise<FormState> {
  const admin = await requireAdmin();
  const base = await appUrl();
  const res = await sendEmail({
    to: [admin.email],
    subject: "Prueba de correo · GES Revisión de Artes",
    html: emailLayout({
      title: "¡El correo funciona!",
      intro: `Hola ${escapeHtml(admin.name.split(" ")[0])}, este es un correo de prueba de GES · Revisión de Artes. Si lo recibiste, los avisos a las facultades y a Marketing Digital se están enviando correctamente.`,
      cta: { label: "Abrir el panel", url: `${base}/admin` },
      logoUrl: `${base}/logo-ges.png`,
    }),
    text: "Correo de prueba de GES · Revisión de Artes. Si lo recibiste, los avisos funcionan.",
  });
  return res.ok ? { error: null, ok: true, message: `Correo de prueba enviado a ${admin.email}. Revisa tu bandeja (y spam).` } : { error: res.message };
}

// ---------- Reporte para Diseño ----------

export async function crearEnlaceReporteAction(campanaId: number) {
  await requireAdmin();
  const campana = await getCampana(campanaId);
  if (!campana) return;
  await asegurarTokenReporte(campana.id);
  revalidatePath(`/admin/facultades/${campana.facultad_id}/campanas/${campana.id}/reporte`);
}

export async function revocarEnlaceReporteAction(campanaId: number) {
  await requireAdmin();
  const campana = await getCampana(campanaId);
  if (!campana) return;
  await revocarTokenReporte(campana.id);
  revalidatePath(`/admin/facultades/${campana.facultad_id}/campanas/${campana.id}/reporte`);
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** Envía a Diseño el enlace del reporte con un resumen de los cambios. */
export async function enviarReporteAction(
  campanaId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const campana = await getCampana(campanaId);
  if (!campana) return { error: "La campaña no existe" };
  const correos = [
    ...new Set(
      String(formData.get("correos") ?? "")
        .split(/[\s,;]+/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (correos.length === 0) return { error: "Escribe al menos un correo de Diseño" };
  const invalido = correos.find((c) => !EMAIL_RE.test(c));
  if (invalido) return { error: `Correo inválido: ${invalido}` };
  if (correos.length > 20) return { error: "Máximo 20 destinatarios" };
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 2000);

  const reporte = await reporteCampana(campana.id, true);
  if (!reporte) return { error: "La campaña no existe" };
  const token = await asegurarTokenReporte(campana.id);
  const base = await appUrl();
  const enlace = `${base}/reporte/${token}`;

  const lista = reporte.artes
    .map(
      (a) =>
        `<li style="margin-bottom:6px"><strong>${escapeHtml(a.titulo)}</strong> (v${a.version}${a.carrera ? ` · ${escapeHtml(a.carrera)}` : ""}): ${a.puntos.length + a.comentarios.length} ${a.puntos.length + a.comentarios.length === 1 ? "cambio" : "cambios"}</li>`
    )
    .join("");
  const html = emailLayout({
    title: `Cambios para diseño: ${campana.nombre}`,
    intro: `${escapeHtml(admin.name)} te comparte el reporte de cambios de la campaña <strong>“${escapeHtml(campana.nombre)}”</strong> (${escapeHtml(reporte.facultad.nombre)}): <strong>${reporte.totales.conCambios}</strong> ${reporte.totales.conCambios === 1 ? "arte con cambios" : "artes con cambios"} y <strong>${reporte.totales.puntos}</strong> ${reporte.totales.puntos === 1 ? "punto marcado" : "puntos marcados"} sobre las imágenes.`,
    body:
      (nota
        ? `<p style="margin-top:16px;margin-bottom:0;padding:12px 14px;background-color:#eef1ff;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#0f172a">${escapeHtml(nota)}</p>`
        : "") +
      (lista
        ? `<ul style="margin-top:16px;padding-left:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#374151">${lista}</ul>`
        : ""),
    cta: { label: "Ver el reporte con las imágenes", url: enlace },
    logoUrl: `${base}/logo-ges.png`,
    footer: `El reporte se actualiza solo: siempre muestra los cambios pendientes de la versión actual. Responde a este correo para escribirle a ${escapeHtml(admin.name)}.`,
  });
  const res = await sendEmail({
    to: correos,
    subject: `Cambios para diseño: ${campana.nombre} (${reporte.facultad.nombre})`,
    html,
    text: `Reporte de cambios de "${campana.nombre}": ${enlace}`,
    replyTo: admin.email,
  });
  revalidatePath(`/admin/facultades/${campana.facultad_id}/campanas/${campana.id}/reporte`);
  return res.ok ? { error: null, ok: true, message: res.message } : { error: res.message };
}
