import "server-only";
import { headers } from "next/headers";

/**
 * Correos con Resend (https://resend.com) usando su API HTTP.
 * - RESEND_API_KEY: llave de envío (variable secreta en Netlify).
 * - RESEND_FROM: remitente, p. ej. "Nombre <remitente@tudominio.com>". Sin dominio
 *   verificado solo funciona "onboarding@resend.dev", que entrega únicamente al dueño de la cuenta.
 * - APP_URL: dirección pública para los enlaces (si falta, se usa la del navegador).
 */

export type EmailResult = { ok: boolean; message: string };
export type Attachment = { filename: string; content: Uint8Array };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailFrom() {
  return process.env.RESEND_FROM || "EOS Nivel 10 <onboarding@resend.dev>";
}

/** URL pública de la app (para los enlaces de los correos). */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** "a@x.com, b@y.com; c@z.com" → lista sin repetidos (o el primer correo inválido). */
export function parseRecipients(raw: string): { emails: string[]; invalid: string | null } {
  const emails = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  return { emails, invalid: emails.find((e) => !EMAIL_RE.test(e)) ?? null };
}

function toBase64(data: Uint8Array) {
  return Buffer.from(data).toString("base64");
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Attachment[];
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
        attachments: input.attachments?.map((a) => ({ filename: a.filename, content: toBase64(a.content) })),
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
export function emailLayout(opts: { title: string; intro: string; body?: string; cta?: { label: string; url: string }; footer?: string; color?: string }) {
  const color = /^#[0-9a-f]{6}$/i.test(opts.color ?? "") ? opts.color! : "#234c6a";
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td bgcolor="${color}" style="background-color:${color};border-radius:8px">
<a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding-top:12px;padding-bottom:12px;padding-left:22px;padding-right:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold">${escapeHtml(opts.cta.label)}</a>
</td></tr></table>
<p style="margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">Si el botón no funciona, copia este enlace: <br><a href="${escapeHtml(opts.cta.url)}" style="color:${color};word-break:break-all">${escapeHtml(opts.cta.url)}</a></p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="background-color:#f3f4f6"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:12px;padding-right:12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px">
<tr><td bgcolor="${color}" style="background-color:${color};border-top-left-radius:12px;border-top-right-radius:12px;padding-top:20px;padding-bottom:20px;padding-left:28px;padding-right:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#ffffff;font-weight:bold">EOS Nivel 10</td></tr>
<tr><td style="padding-top:28px;padding-bottom:28px;padding-left:28px;padding-right:28px">
<h1 style="margin-top:0;margin-bottom:12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#111827">${escapeHtml(opts.title)}</h1>
<p style="margin-top:0;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#374151">${opts.intro}</p>
${opts.body ?? ""}
${cta}
</td></tr>
<tr><td style="padding-top:16px;padding-bottom:20px;padding-left:28px;padding-right:28px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#9ca3af">${opts.footer ?? "Correo automático de EOS Nivel 10."}</td></tr>
</table></td></tr></table></body></html>`;
}
