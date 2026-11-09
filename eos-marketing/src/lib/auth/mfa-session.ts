import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config, isProduction } from "@/lib/config/server";

/**
 * Paso intermedio del inicio de sesión con doble factor: la contraseña ya se verificó y falta el código.
 * Cookie firmada de 5 minutos que solo dice "esta persona pasó la contraseña"; no da acceso a nada más.
 */
const COOKIE = "eos_mfa";
const key = () => new TextEncoder().encode(`${config.auth.secret()}:mfa`);

export async function startMfaChallenge(userId: number, email: string) {
  const token = await new SignJWT({ uid: userId, email, purpose: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/", maxAge: 300 });
}

export async function readMfaChallenge(): Promise<{ userId: number; email: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.purpose !== "mfa" || typeof payload.uid !== "number" || typeof payload.email !== "string") return null;
    return { userId: payload.uid, email: payload.email };
  } catch {
    return null;
  }
}

export async function clearMfaChallenge() {
  (await cookies()).delete(COOKIE);
}
