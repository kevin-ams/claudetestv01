import "server-only";
import { config } from "@/lib/config/server";

/**
 * Microsoft Clarity (mapas de calor y grabaciones de sesión). Se activa solo si en Netlify existe la
 * variable CLARITY_PROJECT_ID (el ID público del proyecto en clarity.microsoft.com); sin ella no se carga nada.
 */
export function clarityProjectId(): string | null {
  return config.analytics.clarityProjectId();
}

/** Snippet oficial de Clarity con el ID ya validado (solo letras y números). */
export function clarityScript(id: string): string {
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`;
}
