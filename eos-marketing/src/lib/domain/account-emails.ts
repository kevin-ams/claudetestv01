import "server-only";
import { appUrl, emailLayout, escapeHtml, sendEmail, type EmailResult } from "@/lib/email";
import { createPasswordToken } from "./password-tokens";

/** Enlace para restablecer la contraseña (válido 1 hora). */
export async function sendPasswordResetEmail(user: { id: number; name: string; email: string }): Promise<EmailResult> {
  const token = await createPasswordToken(user.id, "reset");
  const url = `${await appUrl()}/restablecer?token=${token}`;
  return sendEmail({
    to: [user.email],
    subject: "Restablece tu contraseña de EOS Nivel 10",
    html: emailLayout({
      title: "Restablece tu contraseña",
      intro: `Hola ${escapeHtml(user.name)}, recibimos una solicitud para cambiar tu contraseña. El enlace vence en 1 hora y solo se puede usar una vez.`,
      cta: { label: "Crear nueva contraseña", url },
      footer: "Si no fuiste tú, ignora este correo: tu contraseña no cambia.",
    }),
    text: `Hola ${user.name}, crea tu nueva contraseña aquí (vence en 1 hora): ${url}`,
  });
}

/** Correo de acceso: bienvenida al equipo con enlace para crear su contraseña (válido 7 días). */
export async function sendAccessEmail(
  user: { id: number; name: string; email: string },
  teamName: string,
  invitedBy: string,
  color?: string
): Promise<EmailResult> {
  const token = await createPasswordToken(user.id, "invite");
  const base = await appUrl();
  const url = `${base}/restablecer?token=${token}`;
  return sendEmail({
    to: [user.email],
    subject: `${invitedBy} te dio acceso a ${teamName} en EOS Nivel 10`,
    html: emailLayout({
      title: `Bienvenido(a) a ${escapeHtml(teamName)}`,
      intro: `Hola ${escapeHtml(user.name)}, ${escapeHtml(invitedBy)} te dio acceso a <b>${escapeHtml(teamName)}</b> en EOS Nivel 10: Scorecard, Rocks, To-Dos, Issues, reuniones L10 y más. Crea tu contraseña para entrar; tu usuario es <b>${escapeHtml(user.email)}</b>.`,
      cta: { label: "Crear mi contraseña", url },
      footer: `El enlace vence en 7 días. Después entra en ${escapeHtml(base)}/login. Si vence, usa "¿Olvidaste tu contraseña?".`,
      color,
    }),
    text: `Hola ${user.name}, ${invitedBy} te dio acceso a ${teamName} en EOS Nivel 10. Tu usuario: ${user.email}. Crea tu contraseña (vence en 7 días): ${url}`,
  });
}
