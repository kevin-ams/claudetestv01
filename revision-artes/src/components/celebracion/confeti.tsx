"use client";

import { useEffect, useRef, useState } from "react";

const EVENTO = "ra:confeti";

/** Lanza la animación de confeti (por ejemplo, cuando una campaña queda aprobada). */
export function celebrar(mensaje = "¡Campaña aprobada!") {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: mensaje }));
}

/**
 * Capa de confeti (animación Lottie de /animaciones/confeti.json). Se monta una
 * vez en cada layout y espera el evento de `celebrar()`. Con "reducir
 * movimiento" solo muestra el mensaje.
 */
export function Confeti() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onCelebrar = (e: Event) => setMensaje((e as CustomEvent<string>).detail ?? "¡Listo!");
    window.addEventListener(EVENTO, onCelebrar);
    return () => window.removeEventListener(EVENTO, onCelebrar);
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const cerrar = setTimeout(() => setMensaje(null), 3200);
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let anim: { destroy: () => void } | null = null;
    let cancelado = false;
    if (!reducir && contenedor.current) {
      Promise.all([
        import("lottie-web/build/player/lottie_light"),
        fetch("/animaciones/confeti.json").then((r) => r.json()),
      ])
        .then(([lottie, data]) => {
          if (cancelado || !contenedor.current) return;
          anim = lottie.default.loadAnimation({
            container: contenedor.current,
            renderer: "svg",
            loop: false,
            autoplay: true,
            animationData: data,
            rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
          });
        })
        .catch(() => {
          // sin animación: queda el mensaje
        });
    }
    return () => {
      cancelado = true;
      clearTimeout(cerrar);
      anim?.destroy();
    };
  }, [mensaje]);

  if (!mensaje) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[1100] flex items-center justify-center" role="status" aria-live="polite">
      <div ref={contenedor} className="absolute inset-0" data-testid="confeti" />
      <div className="relative rounded-3xl bg-white/90 px-6 py-4 text-center shadow-2xl backdrop-blur">
        <p className="text-2xl font-bold text-[var(--ges-aprobado-texto)]">🎉 {mensaje}</p>
      </div>
    </div>
  );
}
