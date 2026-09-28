"use server";

import { updateTag } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { CALLS_CACHE_TAG } from "@/lib/calls/source";

/** Descarta la copia en caché y vuelve a leer Google Sheets en el siguiente render. */
export async function syncCallsAction() {
  await requireSession();
  updateTag(CALLS_CACHE_TAG);
}
