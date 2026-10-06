"use client";

/**
 * Preferencias de la guía, guardadas en este navegador (las personas de
 * facultad no tienen cuenta). Se separan por correo por si varias personas
 * usan el mismo equipo. Si el navegador no permite guardar, la guía funciona
 * igual pero se mostrará de nuevo la próxima vez.
 */

type Prefs = { activada: boolean; vistas: string[] };

const clave = (email: string) => `ra-guia:${email.toLowerCase()}`;

function leer(email: string): Prefs {
  try {
    const raw = localStorage.getItem(clave(email));
    if (raw) return { activada: true, vistas: [], ...JSON.parse(raw) };
  } catch {
    // almacenamiento no disponible
  }
  return { activada: true, vistas: [] };
}

function guardar(email: string, prefs: Prefs) {
  try {
    localStorage.setItem(clave(email), JSON.stringify(prefs));
  } catch {
    // almacenamiento no disponible
  }
}

export function guiaActivada(email: string) {
  return leer(email).activada;
}

export function setGuiaActivada(email: string, activada: boolean) {
  guardar(email, { ...leer(email), activada });
}

export function guiaVista(email: string, id: string) {
  return leer(email).vistas.includes(id);
}

export function marcarVista(email: string, id: string) {
  const p = leer(email);
  if (!p.vistas.includes(id)) guardar(email, { ...p, vistas: [...p.vistas, id] });
}

/** Vuelve a mostrar todas las guías desde cero. */
export function reiniciarGuias(email: string) {
  guardar(email, { activada: true, vistas: [] });
}

const EVENTO = "ra:abrir-guia";

export function abrirGuia() {
  window.dispatchEvent(new Event(EVENTO));
}

export function onAbrirGuia(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}
