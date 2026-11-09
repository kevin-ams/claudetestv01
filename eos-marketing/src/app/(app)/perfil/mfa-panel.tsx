"use client";

import { Button, Card, Input } from "@heroui/react";
import { useState, useTransition } from "react";
import { STALE } from "@/lib/client-actions";
import { confirmMfaAction, disableMfaAction, startMfaAction } from "./mfa-actions";

type Step = { kind: "idle" } | { kind: "scan"; qr: string; key: string } | { kind: "codes"; codes: string[] };

/** Doble factor en Mi perfil: activar (QR + primer código + códigos de recuperación) o desactivar. */
export function MfaPanel({ available, enabled, enabledAt, recoveryLeft }: { available: boolean; enabled: boolean; enabledAt: string | null; recoveryLeft: number }) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isOn, setIsOn] = useState(enabled);
  const [pending, start] = useTransition();

  if (!available && !isOn) return null;
  const fail = (text: string) => setMessage({ ok: false, text });

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="font-semibold">Doble factor</h2>
        <p className="text-sm text-muted">
          Además de tu contraseña, al entrar se pide un código de 6 dígitos de una app de tu teléfono (Google Authenticator, Microsoft
          Authenticator, 1Password…). Así nadie entra a tu cuenta aunque sepa tu contraseña.
        </p>
      </div>

      {isOn && step.kind !== "codes" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            <span className="font-semibold text-green">Activo</span>
            {enabledAt && <span className="text-muted"> desde {new Date(enabledAt).toLocaleDateString("es")}</span>}
            <span className="text-muted"> · {recoveryLeft} código(s) de recuperación sin usar</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Código para desactivar" placeholder="Código actual" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
            <Button
              variant="outline"
              isPending={pending}
              isDisabled={!code.trim()}
              onPress={() =>
                start(async () => {
                  const r = await disableMfaAction(code).catch(() => ({ ok: false, message: STALE }));
                  setMessage({ ok: r.ok, text: r.message });
                  if (r.ok) {
                    setIsOn(false);
                    setCode("");
                  }
                })
              }
            >
              Desactivar
            </Button>
          </div>
        </div>
      )}

      {!isOn && step.kind === "idle" && (
        <Button
          variant="primary"
          className="self-start"
          isPending={pending}
          onPress={() =>
            start(async () => {
              const r = await startMfaAction().catch(() => ({ ok: false as const, message: STALE }));
              if (r.ok) {
                setStep({ kind: "scan", qr: r.qrDataUrl, key: r.manualKey });
                setMessage(null);
              } else fail(r.message);
            })
          }
        >
          Activar doble factor
        </Button>
      )}

      {step.kind === "scan" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor como data: URL */}
          <img src={step.qr} alt="Código QR para la app de autenticación" width={180} height={180} className="rounded-lg border border-border bg-white p-1" />
          <div className="flex flex-col gap-2 text-sm">
            <p>1. Escanea el código con tu app de autenticación.</p>
            <p className="text-xs text-muted">
              ¿No puedes escanear? Escribe esta clave: <code className="break-all font-mono">{step.key}</code>
            </p>
            <p>2. Escribe el código de 6 dígitos que muestra la app:</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Código de la app" inputMode="numeric" placeholder="123456" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" />
              <Button
                variant="primary"
                isPending={pending}
                isDisabled={code.replace(/\D/g, "").length !== 6}
                onPress={() =>
                  start(async () => {
                    const r = await confirmMfaAction(code).catch(() => ({ ok: false as const, message: STALE }));
                    if (r.ok) {
                      setStep({ kind: "codes", codes: r.recoveryCodes });
                      setIsOn(true);
                      setCode("");
                      setMessage(null);
                    } else fail(r.message);
                  })
                }
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {step.kind === "codes" && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold text-green">Doble factor activado.</p>
          <p className="text-sm">
            Guarda estos <b>códigos de recuperación</b> en un lugar seguro. Cada uno sirve una sola vez si pierdes tu teléfono. No se volverán a
            mostrar.
          </p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
            {step.codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="self-start" onPress={() => setStep({ kind: "idle" })}>
            Ya los guardé
          </Button>
        </div>
      )}

      {message && <p className={`text-sm ${message.ok ? "text-green" : "text-red"}`}>{message.text}</p>}
    </Card>
  );
}
