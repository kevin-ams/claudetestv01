import type { Metadata } from "next";
import { cookies } from "next/headers";
// Fuentes incluidas en el paquete `geist` (next/font/local): la app no necesita
// internet para arrancar, a diferencia de next/font/google.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { THEME_COOKIE, THEME_INIT_SCRIPT, parseMode } from "@/lib/theme";
import { clarityProjectId, clarityScript } from "@/lib/analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "EOS Nivel 10",
  description: "Sistema en línea para llevar EOS: V/TO, Organigrama, Rocks, Scorecard, Issues, To-Dos y la Reunión Level 10.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const mode = parseMode((await cookies()).get(THEME_COOKIE)?.value);
  // Con "sistema" el servidor no sabe si el equipo está en oscuro: lo decide
  // el script del <head> antes de pintar.
  const resolved = mode === "system" ? undefined : mode;
  const clarity = clarityProjectId();

  return (
    <html
      lang="es"
      data-theme={resolved}
      className={`${resolved ?? ""} ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Va al inicio del <body> (no en <head>): Netlify inserta un comentario en el
            <head> y React se quejaría al hidratar un <head> propio. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Clarity: solo si está configurado (CLARITY_PROJECT_ID en Netlify). */}
        {clarity && <script dangerouslySetInnerHTML={{ __html: clarityScript(clarity) }} />}
        {children}
      </body>
    </html>
  );
}
