import "server-only";
import type { Arte, Autor, Revisor } from "@/lib/domain/artes";
import { getFacultad } from "@/lib/domain/facultades";
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
      intro: `Hola ${escapeHtml(d.nombre)}, el equipo de comunicación subió la <strong>versión ${arte.version}</strong> de <strong>“${escapeHtml(arte.titulo)}”</strong> (${escapeHtml(facultad.nombre)}${arte.carrera_nombre ? ` · ${escapeHtml(arte.carrera_nombre)}` : ""}) con los cambios solicitados.`,
      body: nota
        ? `<p style="margin-top:16px;margin-bottom:0;padding:12px 14px;background-color:#eef3f7;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#1f2937"><strong>Qué se cambió:</strong> ${escapeHtml(nota)}</p>`
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
