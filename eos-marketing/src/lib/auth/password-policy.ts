/**
 * Política de contraseñas (ISO 27001 5.17 / 8.5; OWASP ASVS 6.2). Sirve en el servidor y en los formularios.
 * Aplica a contraseñas nuevas o cambiadas; las actuales siguen funcionando.
 */
export const PASSWORD_MIN = 10;

const COMMON = new Set([
  "1234567890", "12345678910", "0123456789", "123456789a", "qwertyuiop", "contraseña", "contrasena1", "password12",
  "password123", "passw0rd123", "iloveyou12", "abcdefghij", "1q2w3e4r5t", "asdfghjkl1", "qwerty1234", "guatemala1",
  "guatemala123", "marketing1", "marketing123", "bienvenido1", "bienvenido123", "admin12345", "administrador",
  "eosnivel10", "universidad1", "galileo123", "aaaaaaaaaa", "1111111111", "0000000000",
]);

/** Problema de la contraseña, o null si cumple. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > 200) return "La contraseña es demasiado larga.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "Esa contraseña es demasiado común. Usa una frase o combina palabras.";
  const user = email?.split("@")[0]?.toLowerCase();
  if (user && user.length >= 4 && lower.includes(user)) return "La contraseña no debe contener tu correo.";
  return null;
}
