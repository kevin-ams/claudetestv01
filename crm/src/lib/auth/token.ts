import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ams_crm_session";

export type SessionPayload = {
  userId: number;
  role: "admin" | "member";
  name: string;
  email: string;
  avatarUrl: string | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET no está configurado");
  }
  return new TextEncoder().encode(secret || "dev-insecure-secret-change-me");
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
    if (typeof payload.userId !== "number") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
