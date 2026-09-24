"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_MODE, THEME_COOKIE, parseMode, type ThemeMode } from "./theme";

const CHANGE_EVENT = "eos-theme-change";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readMode(): ThemeMode {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(\\w+)`));
  return parseMode(match?.[1]);
}

function applyMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && media().matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.dataset.theme = dark ? "dark" : "light";
}

/** Guarda la preferencia (1 año) y la aplica sin recargar. */
export function setThemeMode(mode: ThemeMode) {
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  applyMode(mode);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribeMode(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

/** Preferencia elegida: claro, oscuro o la del sistema. */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeMode, readMode, () => DEFAULT_MODE);
}

function subscribeDark(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** true si la página se está viendo en oscuro (útil para las gráficas). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeDark,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );
}

/** Con "sistema", sigue los cambios de claro/oscuro del equipo en vivo. */
export function useFollowSystemTheme() {
  const mode = useThemeMode();
  useEffect(() => {
    if (mode !== "system") return;
    const mq = media();
    const onChange = () => applyMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);
}
