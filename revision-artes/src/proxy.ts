import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, PORTAL_COOKIE } from "@/lib/auth/token";

// Redirección optimista según la cookie. La validación real (firma, facultad
// activa, código vigente) se hace en cada página y Server Action.
const PUBLIC = ["/admin/login", "/admin/setup", "/portal/ingresar"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin") && !request.cookies.has(ADMIN_COOKIE)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (pathname.startsWith("/portal") && !request.cookies.has(PORTAL_COOKIE)) {
    const url = new URL("/portal/ingresar", request.url);
    if (pathname !== "/portal") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
