"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
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
  const session = await requireSession();
  if ((await trackTeam(careerId)) !== session.teamId) throw new Error("Carrera no encontrada");
  return session;
}

function refresh() {
  revalidatePath("/control");
}

export async function addTracksAction(careerIds: number[], startDate: string) {
  const session = await requireSession();
  if (!DATE.test(startDate)) throw new Error("Fecha inválida");
  const teamIds = new Set((await listCareers(session.teamId)).map((c) => c.id));
  await addTracks(careerIds.filter((id) => teamIds.has(id)), startDate, session.userId);
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
  refresh();
}

export async function setMilestoneDoneAction(careerId: number, milestone: MilestoneKey, doneOn: string | null) {
  const session = await requireTrack(careerId);
  if (!(await teamKeys(session.teamId)).includes(milestone)) throw new Error("Hito inválido");
  if (doneOn !== null && !DATE.test(doneOn)) throw new Error("Fecha inválida");
  await setMilestoneDone(careerId, milestone, doneOn, session.userId);
  refresh();
}

export async function setTrackStatusAction(careerId: number, status: TrackStatus) {
  const session = await requireTrack(careerId);
  if (status !== "on_track" && status !== "off_track") return;
  await updateTrack(careerId, { status }, session.userId);
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
  await requireTrack(careerId);
  await removeTrack(careerId);
  refresh();
}
