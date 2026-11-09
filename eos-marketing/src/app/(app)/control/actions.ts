"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { listCareers } from "@/lib/domain/careers";
import {
  addTracks,
  moveTrack,
  removeTrack,
  setMilestoneDone,
  trackTeam,
  updateTrack,
} from "@/lib/domain/career-tracks";
import { DONE_COLUMN, type ColumnKey, type MilestoneKey } from "@/lib/domain/career-control";
import { listControlMilestones } from "@/lib/domain/control-milestones";
import type { TrackStatus } from "@/lib/domain/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireTrack(careerId: number) {
  const session = await requireModule("control");
  if ((await trackTeam(careerId)) !== session.teamId) throw new Error("Carrera no encontrada");
  return session;
}

function refresh() {
  revalidatePath("/control");
}

export async function addTracksAction(careerIds: number[], startDate: string) {
  const session = await requireModule("control");
  if (!DATE.test(startDate)) throw new Error("Fecha inválida");
  const teamIds = new Set((await listCareers(session.teamId)).map((c) => c.id));
  await addTracks(careerIds.filter((id) => teamIds.has(id)), startDate, session.userId);
  await logActivity(session, "control", "Agregó carreras a Control de carrera", `${careerIds.length} carrera(s), inicio ${startDate}`);
  refresh();
}

async function teamKeys(teamId: number) {
  return (await listControlMilestones(teamId)).map((m) => m.key);
}

export async function moveTrackAction(careerId: number, column: ColumnKey) {
  const session = await requireTrack(careerId);
  const keys = await teamKeys(session.teamId);
  const target = column === DONE_COLUMN ? null : column;
  if (target !== null && !keys.includes(target)) throw new Error("Hito inválido");
  await moveTrack(careerId, keys, target, session.userId);
  await logActivity(session, "control", "Movió carrera en el tablero", `${await labelOf("careers", careerId)} → ${column}`);
  refresh();
}

export async function setMilestoneDoneAction(careerId: number, milestone: MilestoneKey, doneOn: string | null) {
  const session = await requireTrack(careerId);
  if (!(await teamKeys(session.teamId)).includes(milestone)) throw new Error("Hito inválido");
  if (doneOn !== null && !DATE.test(doneOn)) throw new Error("Fecha inválida");
  await setMilestoneDone(careerId, milestone, doneOn, session.userId);
  await logActivity(session, "control", "Marcó hito de carrera", `${await labelOf("careers", careerId)} · ${milestone}: ${doneOn ?? "pendiente"}`);
  refresh();
}

export async function setTrackStatusAction(careerId: number, status: TrackStatus) {
  const session = await requireTrack(careerId);
  if (status !== "on_track" && status !== "off_track") return;
  await updateTrack(careerId, { status }, session.userId);
  await logActivity(session, "control", "Cambió on/off track", `${await labelOf("careers", careerId)}: ${status === "on_track" ? "On track" : "Off track"}`);
  refresh();
}

export async function setTrackLabelsAction(careerId: number, labels: string[]) {
  const session = await requireTrack(careerId);
  const clean = [...new Set(labels.map((l) => l.trim()).filter(Boolean))].slice(0, 12).map((l) => l.slice(0, 30));
  await updateTrack(careerId, { labels: clean }, session.userId);
  refresh();
}

export async function updateTrackDetailsAction(careerId: number, notes: string, startDate: string) {
  const session = await requireTrack(careerId);
  if (!DATE.test(startDate)) throw new Error("Fecha inválida");
  await updateTrack(careerId, { notes: notes.slice(0, 4000), startDate }, session.userId);
  refresh();
}

export async function removeTrackAction(careerId: number) {
  const session = await requireTrack(careerId);
  const label = await labelOf("careers", careerId);
  await removeTrack(careerId);
  await logActivity(session, "control", "Quitó carrera de Control de carrera", label);
  refresh();
}
