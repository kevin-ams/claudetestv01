import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "llamadas_session";
export const SESSION_DAYS = 30;

export type Session = { name: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Falta la variable AUTH_SECRET");
  }
  return new TextEncoder().encode(secret || "dev-insecure-secret-change-me");
}

export async function signSession(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.name === "string" ? { name: payload.name } : null;
  } catch {
    return null;
  }
}
