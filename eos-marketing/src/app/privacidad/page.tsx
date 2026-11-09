import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad · EOS Nivel 10" };

const PROVIDERS = [
  ["Netlify", "Hospeda la plataforma y guarda las imágenes subidas."],
  ["Neon (Netlify Database)", "Base de datos con la información de EOS, el vault y las cuentas."],
  ["Resend", "Envía los correos (reportes, accesos, recordatorios)."],
  ["ActiveCampaign", "Fuente de los leads y tratos que se sincronizan (si la organización lo conecta)."],
  ["ClickUp", "Importación de tareas a la agenda (si la organización lo conecta)."],
  ["Anthropic (Claude)", "Responde las preguntas del Asistente IA y del conector de Claude (solo si se usan)."],
  ["Microsoft Clarity", "Mide cómo se usa la plataforma; el contenido de las pantallas va oculto en las grabaciones."],
] as const;

/** Aviso de privacidad (ISO 27001 5.34). Público: se puede leer sin iniciar sesión. */
export default function PrivacidadPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10 text-sm leading-relaxed">
      <div>
        <p className="text-xs text-muted">
          <Link prefetch={false} href="/login" className="text-primary underline">
            Iniciar sesión
          </Link>{" "}
          / Privacidad
        </p>
        <h1 className="mt-1 text-2xl font-bold">Aviso de privacidad</h1>
        <p className="text-muted">EOS Nivel 10 es la plataforma interna de la organización para llevar su sistema EOS.</p>
      </div>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Qué datos se guardan</h2>
        <ul className="list-disc pl-5">
          <li>De cada persona: nombre, correo, foto opcional, rol, contraseña cifrada (nunca en texto), último acceso y, si lo activa, la clave del doble factor cifrada.</li>
          <li>El trabajo del equipo: Rocks, Scorecard, Issues, To-Dos, reuniones L10 y sus calificaciones, agenda, indicadores, calendario y notas del vault.</li>
          <li>Registros de seguridad: inicios de sesión, intentos fallidos, cambios de acceso, exportaciones y respaldos, con la dirección IP.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Para qué se usan</h2>
        <p>Solo para operar la plataforma del equipo: mostrar y compartir el trabajo, enviar los correos que el equipo programa y proteger las cuentas. No se venden ni se usan para publicidad.</p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Quién los procesa</h2>
        <ul className="flex flex-col gap-1">
          {PROVIDERS.map(([name, what]) => (
            <li key={name}>
              <b>{name}:</b> {what}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Cuánto tiempo se guardan</h2>
        <ul className="list-disc pl-5">
          <li>El trabajo del equipo: mientras la organización use la plataforma.</li>
          <li>Registros de seguridad: un año. Intentos de inicio de sesión: 30 días.</li>
          <li>Al quitar a una persona de un equipo deja de tener acceso; su cuenta se puede borrar a petición.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Tus derechos</h2>
        <p>
          Puedes ver y corregir tus datos en <b>Mi perfil</b>. Para pedir una copia o el borrado de tu cuenta, escribe al administrador de tu
          organización.
        </p>
      </section>
    </main>
  );
}
