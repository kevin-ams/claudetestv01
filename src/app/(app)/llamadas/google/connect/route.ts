import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { OAUTH_STATE_COOKIE, authorizeUrl, oauthConfigured } from "@/lib/calls/google-oauth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!oauthConfigured()) {
    return NextResponse.redirect(new URL("/llamadas?google_error=Falta+configurar+el+cliente+OAuth", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authorizeUrl(request.nextUrl.origin, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/llamadas/google",
    maxAge: 600,
  });
  return response;
}
