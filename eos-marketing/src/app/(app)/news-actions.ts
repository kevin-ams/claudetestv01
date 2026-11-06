"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { dismissNews } from "@/lib/domain/meetings";

/** Dashboard › Noticias: quitar una noticia del inicio (solo para quien la quita). */
export async function dismissNewsAction(headlineId: number) {
  const session = await requireSession();
  await dismissNews(session.teamId, session.userId, Number(headlineId));
  revalidatePath("/");
}
