import "server-only";
import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash fijo para comparar cuando el correo no existe, así la respuesta tarda lo mismo
// y no revela qué correos tienen cuenta.
const DUMMY_HASH = bcrypt.hashSync("ams-crm-dummy-password", 12);

export async function verifyPasswordOrDummy(password: string, hash: string | null) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== null && ok;
}
