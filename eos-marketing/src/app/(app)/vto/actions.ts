"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { updateVTOField } from "@/lib/domain/vto";

function linesOf(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? "");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function saveCoreValues(formData: FormData) {
  const session = await requireModule("vto");
  await updateVTOField(
    session.teamId,
    "core_values",
    linesOf(formData, "coreValues"),
    session.userId
  );
  await logActivity(session, "vto", "Editó V/TO", "Valores centrales");
  revalidatePath("/vto");
}

export async function saveCoreFocus(formData: FormData) {
  const session = await requireModule("vto");
  await updateVTOField(
    session.teamId,
    "core_focus",
    {
      purpose: String(formData.get("purpose") ?? ""),
      niche: String(formData.get("niche") ?? ""),
    },
    session.userId
  );
  await logActivity(session, "vto", "Editó V/TO", "Enfoque central");
  revalidatePath("/vto");
}

export async function saveTenYearTarget(formData: FormData) {
  const session = await requireModule("vto");
  await updateVTOField(
    session.teamId,
    "ten_year_target",
    String(formData.get("tenYearTarget") ?? ""),
    session.userId
  );
  await logActivity(session, "vto", "Editó V/TO", "Meta a 10 años");
  revalidatePath("/vto");
}

export async function saveMarketingStrategy(formData: FormData) {
  const session = await requireModule("vto");
  await updateVTOField(
    session.teamId,
    "marketing_strategy",
    {
      target_market: String(formData.get("targetMarket") ?? ""),
      three_uniques: linesOf(formData, "threeUniques"),
      proven_process: String(formData.get("provenProcess") ?? ""),
      guarantee: String(formData.get("guarantee") ?? ""),
    },
    session.userId
  );
  await logActivity(session, "vto", "Editó V/TO", "Estrategia de mercadeo");
  revalidatePath("/vto");
}

export async function saveThreeYearPicture(formData: FormData) {
  const session = await requireModule("vto");
  await updateVTOField(
    session.teamId,
    "three_year_picture",
    {
      future_date: String(formData.get("futureDate") ?? ""),
      revenue: String(formData.get("revenue") ?? ""),
      profit: String(formData.get("profit") ?? ""),
      measurables: String(formData.get("measurables") ?? ""),
      looks_like: linesOf(formData, "looksLike"),
    },
    session.userId
  );
  await logActivity(session, "vto", "Editó V/TO", "Visión a 3 años");
  revalidatePath("/vto");
}

export async function saveOneYearPlan(formData: FormData) {
  const session = await requireModule("vto");
  await updateVTOField(
    session.teamId,
    "one_year_plan",
    {
      future_date: String(formData.get("futureDate") ?? ""),
      revenue: String(formData.get("revenue") ?? ""),
      profit: String(formData.get("profit") ?? ""),
      measurables: String(formData.get("measurables") ?? ""),
      goals: linesOf(formData, "goals"),
    },
    session.userId
  );
  await logActivity(session, "vto", "Editó V/TO", "Plan a 1 año");
  revalidatePath("/vto");
}
