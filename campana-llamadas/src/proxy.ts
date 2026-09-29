import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
