import "server-only";
import type { Arte, Autor, Revisor } from "@/lib/domain/artes";
import { getFacultad } from "@/lib/domain/facultades";
import { estadoCampana, getCampana } from "@/lib/domain/campanas";
import { listAdmins } from "@/lib/domain/admins";
import { crearAviso } from "@/lib/domain/avisos";
import { listVersiones, registrarNotificacion } from "@/lib/domain/artes";
import { appUrl, emailLayout, escapeHtml, sendEmail, type EmailResult } from "@/lib/email";

/**
 * Avisa por correo a las personas de facultad indicadas que hay una nueva
 * versión del arte lista para revisar. Un correo por persona (saludo con su
 * nombre) y queda registrado en el historial.
 */
export async function notificarNuevaVersion(
  arte: Arte,
  destinatarios: Revisor[],
  autor: Autor
): Promise<EmailResult> {
  if (destinatarios.length === 0) return { ok: false, message: "Elige al menos una persona para notificar." };
  const facultad = await getFacultad(arte.facultad_id);
  if (!facultad) return { ok: false, message: "La facultad no existe." };

  const base = await appUrl();
  const nota = (await listVersiones(arte.id)).find((v) => v.version === arte.version)?.nota ?? "";
  const enlace = `${base}/portal/ingresar?codigo=${encodeURIComponent(facultad.codigo_acceso)}&next=${encodeURIComponent(`/portal/artes/${arte.id}`)}`;
  const subject = `Nueva versión para revisión: ${arte.titulo} (v${arte.version})`;

  const enviados: string[] = [];
  const errores: string[] = [];
  for (const d of destinatarios) {
    const html = emailLayout({
      title: "Hay una nueva versión lista para revisar",
      intro: `Hola ${escapeHtml(d.nombre)}, el equipo de Marketing Digital subió la <strong>versión ${arte.version}</strong> de <strong>“${escapeHtml(arte.titulo)}”</strong> (${arte.campana_nombre ? `campaña ${escapeHtml(arte.campana_nombre)} · ` : ""}${escapeHtml(facultad.nombre)}${arte.carrera_nombre ? ` · ${escapeHtml(arte.carrera_nombre)}` : ""}) con los cambios solicitados.`,
      body: nota
        ? `<p style="margin-top:16px;margin-bottom:0;padding:12px 14px;background-color:#eef1ff;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#1f2937"><strong>Qué se cambió:</strong> ${escapeHtml(nota)}</p>`
        : "",
      cta: { label: "Revisar ahora", url: enlace },
      logoUrl: `${base}/logo-ges.png`,
      footer: `Recibes este correo porque revisaste este arte en el portal de ${escapeHtml(facultad.nombre)}. Responde a este correo para escribirle a ${escapeHtml(autor.nombre)}.`,
    });
    const text = `Hola ${d.nombre}, hay una nueva versión (v${arte.version}) de "${arte.titulo}" lista para revisar.${nota ? `\nQué se cambió: ${nota}` : ""}\n\nRevisar: ${enlace}`;
    const res = await sendEmail({ to: [d.email], subject, html, text, replyTo: autor.email });
    if (res.ok) enviados.push(d.email);
    else errores.push(res.message);
  }

  if (enviados.length > 0) await registrarNotificacion(arte, enviados, autor);
  if (errores.length === 0) return { ok: true, message: `Aviso enviado a ${enviados.join(", ")}.` };
  if (enviados.length === 0) return { ok: false, message: errores[0] };
  return { ok: false, message: `Enviado a ${enviados.join(", ")}, pero falló para otros: ${errores[0]}` };
}

/**
 * Avisa por correo a quien creó la campaña (o a todos los administradores si
 * no se sabe quién fue) que ya no quedan artes pendientes: todos fueron
 * aprobados o tienen cambios solicitados. `revisor` es quien hizo la última revisión.
 */
export async function avisarCampanaRevisada(campanaId: number, revisor: { nombre: string; email: string }) {
  const campana = await getCampana(campanaId);
  if (!campana) return;
  const estado = await estadoCampana(campana.id);
  if (estado.total === 0 || estado.pendientes > 0) return;
  const facultad = await getFacultad(campana.facultad_id);
  if (!facultad) return;

  await crearAviso({
    titulo:
      estado.cambios === 0
        ? `✅ Campaña aprobada: ${campana.nombre}`
        : `${facultad.nombre} terminó de revisar “${campana.nombre}”`,
    mensaje: `${estado.aprobados} ${estado.aprobados === 1 ? "aprobado" : "aprobados"} y ${estado.cambios} con cambios. Última revisión: ${revisor.nombre}.`,
    url: `/admin/facultades/${facultad.id}/campanas/${campana.id}`,
  });

  const destinatarios = campana.creado_por_email
    ? [{ nombre: campana.creado_por_nombre ?? "", email: campana.creado_por_email }]
    : (await listAdmins()).map((a) => ({ nombre: a.name, email: a.email }));
  if (destinatarios.length === 0) return;

  const base = await appUrl();
  const enlace = `${base}/admin/facultades/${facultad.id}/campanas/${campana.id}`;
  const etiqueta: Record<string, string> = { aprobado: "Aprobado", cambios: "Cambios solicitados" };
  const colorEstado: Record<string, string> = { aprobado: "#15803d", cambios: "#b91c1c" };
  const filas = estado.artes
    .map(
      (a) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827">${escapeHtml(a.titulo)} <span style="color:#6b7280">· v${a.version}${a.carrera ? ` · ${escapeHtml(a.carrera)}` : ""}</span></td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${colorEstado[a.estado] ?? "#374151"};white-space:nowrap">${etiqueta[a.estado] ?? a.estado}</td>
</tr>`
    )
    .join("");
  const resumen =
    estado.cambios === 0
      ? `Los <strong>${estado.total}</strong> artes están <strong>aprobados</strong> y listos para publicarse.`
      : `<strong>${estado.aprobados}</strong> ${estado.aprobados === 1 ? "aprobado" : "aprobados"} y <strong>${estado.cambios}</strong> con <strong>cambios solicitados</strong>.`;

  const subject =
    estado.cambios === 0
      ? `✅ Campaña aprobada: ${campana.nombre} (${facultad.nombre})`
      : `Campaña revisada: ${campana.nombre} (${facultad.nombre})`;

  for (const d of destinatarios) {
    const html = emailLayout({
      title: estado.cambios === 0 ? "Campaña aprobada por completo" : "La facultad terminó de revisar la campaña",
      intro: `Hola${d.nombre ? ` ${escapeHtml(d.nombre.split(" ")[0])}` : ""}, ${escapeHtml(facultad.nombre)} terminó de revisar todos los artes de la campaña <strong>“${escapeHtml(campana.nombre)}”</strong>. ${resumen}`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">${filas}</table>
<p style="margin-top:12px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#6b7280">Última revisión: ${escapeHtml(revisor.nombre)} (${escapeHtml(revisor.email)}).</p>`,
      cta: { label: "Ver la campaña", url: enlace },
      logoUrl: `${base}/logo-ges.png`,
      footer: campana.creado_por_email
        ? "Recibes este aviso porque creaste esta campaña en GES · Revisión de Artes."
        : "Recibes este aviso porque eres administrador de GES · Revisión de Artes (la campaña no tiene creador registrado).",
    });
    const text = `${facultad.nombre} terminó de revisar la campaña "${campana.nombre}": ${estado.aprobados} aprobados, ${estado.cambios} con cambios.\n\n${estado.artes
      .map((a) => `- ${a.titulo} (v${a.version}): ${etiqueta[a.estado] ?? a.estado}`)
      .join("\n")}\n\nVer la campaña: ${enlace}`;
    const res = await sendEmail({ to: [d.email], subject, html, text, replyTo: revisor.email });
    if (!res.ok) console.error("[aviso campaña revisada]", campana.id, d.email, res.message);
  }
}
