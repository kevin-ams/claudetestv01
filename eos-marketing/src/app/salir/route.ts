import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

/**
 * Cierra una sesión que ya no corresponde a la base de datos (por ejemplo,
 * después de borrar `.data/` o de abrir una copia nueva de la app) y manda a
 * /login, que a su vez lleva a /setup si todavía no hay usuarios.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
