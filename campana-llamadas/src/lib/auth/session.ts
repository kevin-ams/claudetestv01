import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, verifySession, type Session } from "./token";

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  return session;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * SESSION_DAYS,
};
