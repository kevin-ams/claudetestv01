import type { Metadata } from "next";
// Fuentes incluidas en el paquete `geist` (next/font/local): la app no necesita
// internet para arrancar, a diferencia de next/font/google.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "EOS Nivel 10",
  description: "Sistema en línea para llevar EOS: V/TO, Organigrama, Rocks, Scorecard, Issues, To-Dos y la Reunión Level 10.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // Tema claro de HeroUI fijo: la app aún no tiene modo oscuro.
      data-theme="light"
      className={`light ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
