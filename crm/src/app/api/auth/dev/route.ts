import { NextResponse, type NextRequest } from "next/server";
import { isDevLoginEnabled } from "@/lib/auth/dev";
import { allowedDomain } from "@/lib/auth/google";
import { createSessionCookie } from "@/lib/auth/session";
import { upsertUserFromGoogle } from "@/lib/domain/users";

export async function POST(request: NextRequest) {
  if (!isDevLoginEnabled()) {
    return new NextResponse("No disponible", { status: 404 });
  }
  const user = await upsertUserFromGoogle({
    googleSub: null,
    email: `dev@${allowedDomain()}`,
    name: "Usuario de desarrollo",
    avatarUrl: null,
  });
  await createSessionCookie({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
  });
  return NextResponse.redirect(new URL("/", request.url), 303);
}
