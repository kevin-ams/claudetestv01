import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config/server";

export const SESSION_COOKIE = "eos_session";

export type SessionPayload = {
  userId: number;
  teamId: number;
  role: "admin" | "member";
  name: string;
  email: string;
};

/** Clave de firma. Sin AUTH_SECRET en producción lanza un error (falla segura): nunca se usa una clave conocida. */
function secretKey() {
  return new TextEncoder().encode(config.auth.secret());
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "number" ||
      typeof payload.teamId !== "number"
    ) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
