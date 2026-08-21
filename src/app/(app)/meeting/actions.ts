"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  createMeeting,
  startMeeting,
  setSegment,
  completeMeeting,
  addHeadline,
  rateMeeting,
} from "@/lib/domain/meetings";

export async function startNewMeetingAction() {
  const session = await requireSession();
  const meeting = await createMeeting(session.teamId, session.userId, null);
  await startMeeting(meeting.id);
  redirect(`/meeting/${meeting.id}`);
}

export async function advanceSegmentAction(meetingId: number, segmentKey: string) {
  await requireSession();
  await setSegment(meetingId, segmentKey);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function addHeadlineAction(
  meetingId: number,
  type: "customer" | "employee",
  content: string
) {
  const session = await requireSession();
  if (!content.trim()) return;
  await addHeadline({ meetingId, type, content: content.trim(), createdBy: session.userId });
  revalidatePath(`/meeting/${meetingId}`);
}

export async function rateMeetingAction(meetingId: number, rating: number) {
  const session = await requireSession();
  await rateMeeting(meetingId, session.userId, rating);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function completeMeetingAction(meetingId: number) {
  await requireSession();
  await completeMeeting(meetingId);
  revalidatePath("/meeting");
  redirect("/meeting");
}
