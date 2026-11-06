import "server-only";
import { getTeam, teamReplyTo } from "@/lib/domain/teams";
import { appUrl, emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

// Correo "te enviaron un To-Do / Issue" cuando se manda a otro equipo con responsable. Compartido por ambos módulos.

const P = "font-family:Arial,Helvetica,sans-serif;";
const KIND = {
  todo: { noun: "To-Do", title: "Te asignaron un To-Do", list: "Ver To-Dos", path: "/todos", verb: "te envió un To-Do en" },
  issue: { noun: "Issue", title: "Te enviaron un Issue", list: "Ver Issues", path: "/issues", verb: "envió un Issue con tu nombre como responsable a" },
} as const;

/**
 * Avisa por correo al responsable en el otro equipo. Devuelve el texto para agregar al mensaje de la pantalla
 * ("" si no corresponde avisar: sin correo configurado, sin responsable o cuenta local).
 */
export async function notifyAssignee(input: {
  kind: keyof typeof KIND;
  sender: { name: string; email: string; teamId: number };
  targetTeamName: string;
  owner: { name: string; email: string } | null;
  title: string;
  description?: string | null;
  dueDate: string | null;
}): Promise<string> {
  const { owner } = input;
  if (!owner || owner.email.endsWith(".local") || !emailConfigured()) return "";
  const k = KIND[input.kind];
  const from = await getTeam(input.sender.teamId);
  const fromName = from?.name ?? "otro equipo";
  const mail = await sendEmail({
    to: [owner.email],
    replyTo: await teamReplyTo(input.sender.teamId, input.sender.email),
    subject: `Nuevo ${k.noun} de ${fromName}: ${input.title}`,
    html: emailLayout({
      title: k.title,
      intro: `${escapeHtml(input.sender.name)} (${escapeHtml(fromName)}) ${k.verb} <b>${escapeHtml(input.targetTeamName)}</b>:`,
      body:
        `<p style="${P}font-size:16px;line-height:22px;color:#111827;font-weight:bold;margin:16px 0 4px">${escapeHtml(input.title)}</p>` +
        (input.description ? `<p style="${P}font-size:14px;line-height:21px;color:#374151;white-space:pre-line;margin:0">${escapeHtml(input.description)}</p>` : "") +
        (input.dueDate ? `<p style="${P}font-size:14px;line-height:21px;color:#374151;margin:8px 0 0">Fecha: <b>${escapeHtml(input.dueDate)}</b></p>` : ""),
      cta: { label: k.list, url: `${await appUrl()}${k.path}` },
    }),
  });
  return mail.ok ? ` Se avisó por correo a ${owner.name}.` : ` (No se pudo avisar por correo: ${mail.message})`;
}

/** Equipos de la organización a los que se puede enviar algo, con sus personas. */
export { listShareableTeams } from "@/lib/domain/scorecard";
