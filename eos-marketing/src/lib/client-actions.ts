/**
 * Lado del navegador de las server actions: un solo mensaje cuando la llamada misma falla
 * (red, o una versión nueva publicada que invalidó la acción) y un helper para no repetirlo.
 */
export type ActionResult = { ok: boolean; message: string };

export const STALE = "No se pudo completar. Si se publicó una versión nueva, recarga la página.";

/** Espera la acción; si la llamada falla, devuelve `{ ok: false }` con el mensaje estándar (o `fail`). */
export function callAction<T extends ActionResult>(p: Promise<T>, fail: string = STALE): Promise<T | ActionResult> {
  return p.catch(() => ({ ok: false, message: fail }));
}

/** Igual que `callAction`, para acciones que devuelven otro tipo: usa `fallback` si la llamada falla. */
export function safeCall<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}
