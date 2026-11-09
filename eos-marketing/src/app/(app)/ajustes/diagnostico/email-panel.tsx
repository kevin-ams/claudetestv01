"use client";

import { Card } from "@heroui/react";
import { SendEmailInline } from "@/components/send-email-button";
import { sendTestEmailAction } from "./actions";
import { StatusIcon } from "@/components/status-icon";

export function EmailPanel({ configured, from, canTest }: { configured: boolean; from: string; canTest: boolean }) {
  const testing = from.includes("resend.dev");
  return (
    <Card>
      <Card.Header>
        <Card.Title>Correo (Resend)</Card.Title>
        <Card.Description>
          Se usa para recuperar contraseñas, enviar accesos, el resumen de la reunión L10 y la planificación semanal.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3 text-sm">
        <p className={configured ? "text-green" : "text-red"}>
          <StatusIcon status={configured} />
        {configured ? "Conectado" : "Sin configurar: falta la variable RESEND_API_KEY en Netlify."} · Remitente:{" "}
          <b className="text-foreground">{from}</b>
        </p>
        {configured && testing && (
          <p className="rounded-lg bg-yellow-bg px-3 py-2 text-yellow">
            Remitente de prueba de Resend: solo entrega al correo del dueño de la cuenta. Verifica tu dominio en Resend y
            define RESEND_FROM (p. ej. &quot;EOS Nivel 10 &lt;eos@tudominio.com&gt;&quot;) para enviar a cualquiera.
          </p>
        )}
        {configured && canTest && (
          <SendEmailInline
            label="Enviarme un correo de prueba"
            variant="secondary"
            size="sm"
            hint="Se envía a tu propio correo."
            placeholder="(se envía a tu correo)"
            send={() => sendTestEmailAction()}
          />
        )}
      </Card.Content>
    </Card>
  );
}
