"use client";

import { Button } from "@heroui/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { demoStepAction, enterDemoAction, stopDemoAction, type DemoResult } from "./actions";

type Status =
  | { kind: "idle" }
  | { kind: "running"; step: number; label: string }
  | { kind: "stopping" }
  | { kind: "done"; result: DemoResult };

export function DemoControls({
  inDemo,
  hasDemo,
  canEdit,
  stepLabels,
}: {
  inDemo: boolean;
  hasDemo: boolean;
  canEdit: boolean;
  stepLabels: string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const total = stepLabels.length + 1; // + abrir la demo
  const busy = status.kind === "running" || status.kind === "stopping";

  async function create() {
    try {
      for (let i = 0; i < stepLabels.length; i++) {
        setStatus({ kind: "running", step: i, label: stepLabels[i] });
        const res = await demoStepAction(i);
        if (!res.ok) {
          setStatus({ kind: "done", result: res });
          return;
        }
      }
      setStatus({ kind: "running", step: stepLabels.length, label: "Abriendo la demo" });
      const res = await enterDemoAction();
      setStatus({ kind: "done", result: res.ok ? { ok: true, message: "¡Demo lista! Te llevamos al Dashboard…" } : res });
      if (res.ok) {
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1200);
      }
    } catch (err) {
      setStatus({
        kind: "done",
        result: { ok: false, message: `Error de conexión con el servidor: ${err instanceof Error ? err.message : String(err)}` },
      });
    }
  }

  async function enter() {
    setStatus({ kind: "running", step: stepLabels.length, label: "Abriendo la demo" });
    const res = await enterDemoAction().catch((e) => ({ ok: false, message: String(e) }));
    setStatus({ kind: "done", result: res });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  async function stop() {
    setStatus({ kind: "stopping" });
    const res = await stopDemoAction().catch((e) => ({ ok: false, message: String(e) }));
    setStatus({ kind: "done", result: res });
    router.refresh();
  }

  if (!canEdit && !hasDemo) {
    return <p className="text-sm text-muted">Solo un administrador puede activar la información demo.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!hasDemo && canEdit && (
          <Button variant="primary" isDisabled={busy} onPress={create}>
            Ver plataforma con información demo
          </Button>
        )}
        {hasDemo && !inDemo && (
          <Button variant="primary" isDisabled={busy} onPress={enter}>
            Ir a la demo
          </Button>
        )}
        {hasDemo && canEdit && (
          <Button variant="outline"
            isDisabled={busy}
            onPress={() => {
              if (confirm("¿Regenerar la demo? Se borran los cambios hechos dentro de ella.")) void create();
            }}
          >
            Regenerar demo
          </Button>
        )}
        {hasDemo && (
          <Button variant="danger-soft" isDisabled={busy} onPress={stop}>
            Desactivar información demo
          </Button>
        )}
      </div>

      {status.kind === "running" && (
        <ProgressBar
          value={(status.step / total) * 100}
          label={`Paso ${status.step + 1} de ${total}: ${status.label}…`}
        />
      )}
      {status.kind === "stopping" && <ProgressBar label="Desactivando y borrando la información demo…" />}
      {status.kind === "done" && (
        <div className="flex flex-col gap-2">
          <ProgressBar value={100} tone={status.result.ok ? "green" : "red"} />
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-sm ${status.result.ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}
          >
            {status.result.ok ? "✓ " : "✕ "}
            {status.result.message}
            {!status.result.ok && (
              <span className="mt-1 block text-xs">
                Si el error continúa, revisa la terminal donde corre <code>npm run dev</code> (las líneas que empiezan con
                “[demo]”) y la página Ajustes › Diagnóstico.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
