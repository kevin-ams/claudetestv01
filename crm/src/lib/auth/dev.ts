// Acceso local sin Google, para desarrollar antes de tener credenciales OAuth.
// Solo existe con `next dev` y DEV_LOGIN=true.
export function isDevLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "true";
}
