import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, isGoogleConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    buildAuthUrl(request.nextUrl.origin, state)
  );
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
