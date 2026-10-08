import { SignJWT, jwtVerify } from "jose";

// Dos sesiones independientes: el panel de administración y el portal de
// facultades usan cookies distintas para que nunca se mezclen.
export const ADMIN_COOKIE = "ra_admin";
export const PORTAL_COOKIE = "ra_portal";

export type AdminSession = {
  kind: "admin";
  adminId: number;
  name: string;
  email: string;
};

// Quien entra al portal no tiene cuenta: solo nombre, correo y la facultad
// a la que da acceso el código. Guardamos el código para que, si el
// administrador lo regenera, las sesiones anteriores dejen de valer.
export type PortalSession = {
  kind: "portal";
  facultadId: number;
  codigo: string;
  name: string;
  email: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    // Nunca firmar sesiones con un secreto conocido en producción.
    throw new Error("Falta AUTH_SECRET: configúralo en las variables de entorno del sitio.");
  }
  return new TextEncoder().encode(secret || "dev-insecure-secret-change-me");
}

export async function signToken(
  payload: AdminSession | PortalSession,
  expiresIn: string
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "admin" || typeof payload.adminId !== "number") return null;
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function verifyPortalToken(token: string): Promise<PortalSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      payload.kind !== "portal" ||
      typeof payload.facultadId !== "number" ||
      typeof payload.codigo !== "string"
    ) {
      return null;
    }
    return payload as unknown as PortalSession;
  } catch {
    return null;
  }
}
