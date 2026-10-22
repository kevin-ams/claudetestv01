import { NextResponse, type NextRequest } from "next/server";
import { destroySessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await destroySessionCookie();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
