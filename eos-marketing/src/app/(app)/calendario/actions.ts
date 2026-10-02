"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import {
  addOption,
  createKeyDate,
  createPiece,
  deleteKeyDate,
  deleteOption,
  deletePiece,
  getPiece,
  isOptionKind,
  setPieceStatus,
  updatePiece,
  type PieceInput,
} from "@/lib/domain/editorial";
import { CAPAS } from "@/lib/domain/editorial-shared";
import { isUserInTeam } from "@/lib/domain/users";
import { formatWeekRange, weekStartISO } from "@/lib/utils/dates";
import { weekPlanPdf } from "@/lib/domain/week-plan";
import { setPlanningRecipients } from "@/lib/domain/teams";
import { emailLayout, escapeHtml, parseRecipients, sendEmail } from "@/lib/email";
import { parseISO } from "date-fns";

export type ActionResult = { ok: boolean; message: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// "-" es el valor de "ninguno" en los desplegables.
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "-" ? "" : v;
};

async function readPiece(fd: FormData, teamId: number): Promise<PieceInput | string> {
  const title = str(fd, "title");
  if (!title) return "Escribe el tema de la pieza.";
  const pubDate = str(fd, "pub_date");
  let week = str(fd, "week_start");
  if (pubDate && !ISO.test(pubDate)) return "Fecha inválida.";
  // Sin semana pero con fecha: la semana es la de esa fecha. "banco" = sin semana.
  if (week === "banco") week = "";
  else if (!week && pubDate) week = weekStartISO(parseISO(pubDate));
  else if (week && ISO.test(week)) week = weekStartISO(parseISO(week));
  else if (week) return "Semana inválida.";
  const link = str(fd, "link");
  if (link && !/^https?:\/\/\S+$/i.test(link)) return "El link debe empezar con http:// o https://";
  const capa = str(fd, "capa");
  const assignee = Number(str(fd, "assignee_id")) || null;
  if (assignee && !(await isUserInTeam(assignee, teamId))) return "Esa persona no pertenece al equipo.";
  return {
    week_start: week || null,
    pub_date: pubDate || null,
    title,
    pilar: str(fd, "pilar"),
    capa: (CAPAS as readonly string[]).includes(capa) ? capa : "",
    assignee_id: assignee,
    frente: str(fd, "frente"),
    audiencia: str(fd, "audiencia"),
    facultad: str(fd, "facultad"),
    carrera: str(fd, "carrera"),
    cta: str(fd, "cta"),
    link,
    status: str(fd, "status") || "Programado",
    note: str(fd, "note"),
    is_buffer: fd.get("is_buffer") === "on" || fd.get("is_buffer") === "true",
  };
}

function refresh() {
  revalidatePath("/calendario");
}

export async function savePieceAction(id: number | null, fd: FormData): Promise<ActionResult> {
  const session = await requireModule("calendario");
  const input = await readPiece(fd, session.teamId);
  if (typeof input === "string") return { ok: false, message: input };
  if (id) {
    if (!(await getPiece(session.teamId, id))) return { ok: false, message: "Pieza no encontrada." };
    await updatePiece(session.teamId, id, input);
    await logActivity(session, "calendario", "Editó pieza", input.title);
  } else {
    await createPiece(session.teamId, input);
    await logActivity(session, "calendario", "Agregó pieza", `${input.title}${input.week_start ? ` (semana ${input.week_start})` : " (banco)"}`);
  }
  refresh();
  return { ok: true, message: "Guardado." };
}

export async function setPieceStatusAction(id: number, status: string) {
  const session = await requireModule("calendario");
  const piece = await getPiece(session.teamId, id);
  if (!piece || !status) return;
  await setPieceStatus(session.teamId, id, status);
  await logActivity(session, "calendario", "Cambió estado de pieza", `${piece.title}: ${status}`);
  refresh();
}

export async function deletePieceAction(id: number) {
  const session = await requireModule("calendario");
  const piece = await getPiece(session.teamId, id);
  if (!piece) return;
  await deletePiece(session.teamId, id);
  await logActivity(session, "calendario", "Eliminó pieza", piece.title);
  refresh();
}

export async function addKeyDateAction(fd: FormData): Promise<ActionResult> {
  const session = await requireModule("calendario");
  const date = str(fd, "date");
  const title = str(fd, "title");
  if (!ISO.test(date) || !title) return { ok: false, message: "Escribe la fecha y el nombre." };
  await createKeyDate(session.teamId, {
    date,
    title,
    facultad: str(fd, "facultad"),
    carrera: str(fd, "carrera"),
    pilar: str(fd, "pilar"),
    capa: str(fd, "capa"),
    angle: str(fd, "angle"),
    priority: str(fd, "priority"),
    note: str(fd, "note"),
  });
  await logActivity(session, "calendario", "Agregó fecha clave", `${date} · ${title}`);
  refresh();
  return { ok: true, message: "Fecha agregada." };
}

export async function deleteKeyDateAction(id: number) {
  const session = await requireModule("calendario");
  await deleteKeyDate(session.teamId, id);
  refresh();
}

/** Listas editables; las de coberturas (cob_*) se cuidan con el permiso de ese módulo. */
export async function addOptionAction(kind: string, value: string, hint = ""): Promise<ActionResult> {
  if (!isOptionKind(kind)) return { ok: false, message: "Lista inválida." };
  const session = await requireModule(kind.startsWith("cob_") ? "coberturas" : "calendario");
  const v = value.trim();
  if (!v) return { ok: false, message: "Escribe un valor." };
  await addOption(session.teamId, kind, v, hint.trim());
  await logActivity(session, kind.startsWith("cob_") ? "coberturas" : "calendario", "Agregó opción de lista", `${kind}: ${v}`);
  revalidatePath("/calendario");
  revalidatePath("/coberturas");
  return { ok: true, message: "Agregado." };
}

export async function deleteOptionAction(kind: string, id: number) {
  if (!isOptionKind(kind)) return;
  const session = await requireModule(kind.startsWith("cob_") ? "coberturas" : "calendario");
  await deleteOption(session.teamId, id);
  revalidatePath("/calendario");
  revalidatePath("/coberturas");
}

/** Envía por correo el PDF de planificación de la semana; recuerda los destinatarios del equipo. */
export async function sendWeekPlanAction(week: string, recipients: string): Promise<ActionResult> {
  const session = await requireModule("calendario", "view");
  if (!ISO.test(week)) return { ok: false, message: "Semana inválida." };
  const { emails, invalid } = parseRecipients(recipients);
  if (invalid) return { ok: false, message: `Correo inválido: ${invalid}` };
  if (emails.length === 0) return { ok: false, message: "Escribe al menos un correo." };

  const { pdf, week: monday, team, pieces } = await weekPlanPdf(session.teamId, week);
  await setPlanningRecipients(session.teamId, emails.join(", "));
  const range = formatWeekRange(monday);
  const active = pieces.filter((p) => !["Cancelado", "Reprogramado"].includes(p.status));
  const result = await sendEmail({
    to: emails,
    replyTo: session.email,
    subject: `Planificación de contenido · ${team?.name ?? "Equipo"} · ${range}`,
    html: emailLayout({
      title: "Planificación semanal de contenido",
      intro: `${escapeHtml(session.name)} comparte la planificación de <b>${escapeHtml(team?.name ?? "el equipo")}</b> para la semana del <b>${escapeHtml(range)}</b>: ${active.length} pieza(s). El detalle va adjunto en PDF.`,
      color: team?.theme_color,
    }),
    attachments: [{ filename: `planificacion-contenido_${monday}.pdf`, content: pdf }],
  });
  if (result.ok) await logActivity(session, "calendario", "Envió planificación por correo", `Semana ${monday} → ${emails.join(", ")}`);
  return result;
}
