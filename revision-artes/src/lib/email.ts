import "server-only";
import { headers } from "next/headers";

/**
 * Correos con Resend (https://resend.com) usando su API HTTP, igual que en EOS.
 * - RESEND_API_KEY: llave de envío (variable secreta en Netlify).
 * - RESEND_FROM: remitente, p. ej. "Nombre <remitente@tudominio.com>". Sin dominio
 *   verificado solo funciona "onboarding@resend.dev", que entrega únicamente al dueño de la cuenta.
 * - APP_URL: dirección pública para los enlaces (si falta, se usa la del navegador).
 */

export type EmailResult = { ok: boolean; message: string };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailFrom() {
  return process.env.RESEND_FROM || "GES Revisión de Artes <onboarding@resend.dev>";
}

/** URL pública de la app (para los enlaces de los correos). */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, message: "El correo no está configurado (falta RESEND_API_KEY)." };
  if (input.to.length === 0) return { ok: false, message: "No hay destinatarios." };
  try {
    const res = await fetch(`${process.env.RESEND_API_URL || "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom(),
        to: input.to.slice(0, 50),
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (res.ok) return { ok: true, message: `Correo enviado a ${input.to.join(", ")}.` };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = body.message ?? `Error ${res.status}`;
    if (/only send testing emails|verify a domain/i.test(msg)) {
      return {
        ok: false,
        message:
          "Resend todavía no tiene un dominio verificado: por ahora solo puede enviar al correo del dueño de la cuenta. Verifica el dominio en Resend para enviar a cualquier persona.",
      };
    }
    console.error("[correo] Resend:", res.status, msg);
    return { ok: false, message: `No se pudo enviar el correo: ${msg}` };
  } catch (e) {
    console.error("[correo]", e);
    return { ok: false, message: "No se pudo conectar con el servicio de correo." };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plantilla sencilla compatible con clientes de correo (tablas y estilos en línea). */
export function emailLayout(opts: {
  title: string;
  intro: string;
  body?: string;
  cta?: { label: string; url: string };
  footer?: string;
  logoUrl?: string;
}) {
  const color = "#2563ff"; // Royal Blue (paleta GES)
  const logo = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" width="36" height="36" alt="GES" style="display:inline-block;vertical-align:middle;border-radius:18px;margin-right:10px">`
    : "";
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td bgcolor="${color}" style="background-color:${color};border-radius:8px">
<a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding-top:12px;padding-bottom:12px;padding-left:22px;padding-right:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold">${escapeHtml(opts.cta.label)}</a>
</td></tr></table>
<p style="margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">Si el botón no funciona, copia este enlace: <br><a href="${escapeHtml(opts.cta.url)}" style="color:${color};word-break:break-all">${escapeHtml(opts.cta.url)}</a></p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f6ff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6ff" style="background-color:#f4f6ff"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:12px;padding-right:12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px">
<tr><td bgcolor="${color}" style="background-color:${color};border-top-left-radius:12px;border-top-right-radius:12px;padding-top:16px;padding-bottom:16px;padding-left:28px;padding-right:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#ffffff;font-weight:bold">${logo}GES · Revisión de Artes</td></tr>
<tr><td style="padding-top:28px;padding-bottom:28px;padding-left:28px;padding-right:28px">
<h1 style="margin-top:0;margin-bottom:12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#0f172a">${escapeHtml(opts.title)}</h1>
<p style="margin-top:0;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#374151">${opts.intro}</p>
${opts.body ?? ""}
${cta}
</td></tr>
<tr><td style="padding-top:16px;padding-bottom:20px;padding-left:28px;padding-right:28px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#9ca3af">${opts.footer ?? "Correo automático de GES · Revisión de Artes."}</td></tr>
</table></td></tr></table></body></html>`;
}
