import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  PORTAL_COOKIE,
  signToken,
  verifyAdminToken,
  verifyPortalToken,
  type AdminSession,
  type PortalSession,
} from "./token";
import { getFacultad, type Facultad } from "@/lib/domain/facultades";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// ---- Administración ----

export async function startAdminSession(payload: Omit<AdminSession, "kind">) {
  const token = await signToken({ kind: "admin", ...payload }, "7d");
  (await cookies()).set(ADMIN_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminToken(token) : null;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

// ---- Portal de facultades ----

export async function startPortalSession(payload: Omit<PortalSession, "kind">) {
  const token = await signToken({ kind: "portal", ...payload }, "12h");
  (await cookies()).set(PORTAL_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 12 });
}

export async function endPortalSession() {
  (await cookies()).delete(PORTAL_COOKIE);
}

/**
 * Devuelve la sesión del portal solo si la facultad sigue activa y el código
 * con el que se ingresó sigue vigente. Todo acceso a datos del portal debe
 * filtrar por `facultad.id` de esta función.
 */
export async function getPortalSession(): Promise<
  { session: PortalSession; facultad: Facultad } | null
> {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyPortalToken(token);
  if (!session) return null;
  const facultad = await getFacultad(session.facultadId);
  if (!facultad || !facultad.activa || facultad.codigo_acceso !== session.codigo) {
    return null;
  }
  return { session, facultad };
}

export async function requirePortal() {
  const result = await getPortalSession();
  if (!result) redirect("/portal/ingresar");
  return result;
}
