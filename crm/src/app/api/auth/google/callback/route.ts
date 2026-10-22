import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForProfile,
  isAllowedProfile,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth/google";
import { createSessionCookie } from "@/lib/auth/session";
import { upsertUserFromGoogle } from "@/lib/domain/users";

function fail(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || state !== expectedState) {
    return fail(request, "state");
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(request.nextUrl.origin, code);
  } catch {
    return fail(request, "google");
  }

  if (!isAllowedProfile(profile)) {
    return fail(request, "domain");
  }

  const user = await upsertUserFromGoogle({
    googleSub: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture ?? null,
  });
  if (!user.active) {
    return fail(request, "inactive");
  }

  await createSessionCookie({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
  });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
