import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { OAUTH_STATE_COOKIE, completeConnection } from "@/lib/calls/google-oauth";
import { CALLS_CACHE_TAG } from "@/lib/calls/source";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const back = (error?: string) => {
    const url = new URL("/llamadas", request.url);
    if (error) url.searchParams.set("google_error", error);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/llamadas/google" });
    return res;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(`Google canceló la conexión (${params.get("error")}).`);

  const state = params.get("state");
  const code = params.get("code");
  if (!code || !state || state !== request.cookies.get(OAUTH_STATE_COOKIE)?.value) {
    return back("La solicitud expiró o no es válida. Inténtalo de nuevo.");
  }

  try {
    await completeConnection(code, request.nextUrl.origin, session.userId);
  } catch (e) {
    return back(e instanceof Error ? e.message : "No se pudo conectar con Google.");
  }
  revalidateTag(CALLS_CACHE_TAG, { expire: 0 });
  return back();
}
