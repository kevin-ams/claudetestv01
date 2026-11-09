import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config/server";

/**
 * Cifrado de datos sensibles en la base (ISO 27001 8.24): AES-256-GCM con una clave derivada (HKDF) de AUTH_SECRET.
 * Formato: "v1:<iv>:<tag>:<cifrado>" en base64url. Si AUTH_SECRET cambia, lo cifrado deja de leerse
 * (ver el procedimiento de rotación en docs/seguridad/configuracion.md).
 */
function key(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", config.auth.secret(), "eos-nivel-10", `eos:${purpose}`, 32));
}

export function encrypt(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decrypt(sealed: string, purpose: string): string | null {
  try {
    const [v, iv, tag, data] = sealed.split(":");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
