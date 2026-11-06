"use client";

import { Button, Chip, Input, Modal } from "@heroui/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { connectInfoAction, createTokenAction, revokeTokenAction, setConsultantUrlAction, type ConnectInfo } from "./actions";
import { STALE } from "@/lib/client-actions";

const WHEN = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input aria-label={label} value={value} readOnly className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        size="sm"
        variant="outline"
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

/** Conectar con Claude: tokens del servidor MCP (vault o EOS completo) y enlace al consultor IA. */
export function ConnectClaudeDialog({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [label, setLabel] = useState("Claude");
  const [scope, setScope] = useState<"vault" | "eos">("vault");
  const [write, setWrite] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [consultant, setConsultant] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(
    () =>
      connectInfoAction()
        .then((i) => {
          setInfo(i);
          setConsultant(i.consultantUrl ?? "");
        })
        .catch(() => setMessage({ ok: false, message: STALE })),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const url = created && info ? `${info.base}/api/mcp/${created}` : null;
  const active = info?.tokens.filter((t) => !t.revoked_at) ?? [];

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Conectar con Claude" className="sm:max-w-2xl">
          <Modal.CloseTrigger />
          <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto pr-1">
            <div>
              <h2 className="text-lg font-semibold">Conectar con Claude</h2>
              <p className="text-sm text-muted">
                Claude (claude.ai, Claude Desktop o Claude Code) puede consultar el vault —y, si quieres, todo el EOS— con los mismos permisos que tu
                rol. La IA la pone Claude: no tiene costo extra en EOS.
              </p>
            </div>

            <section className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">1. Genera un token</h3>
              <Input aria-label="Nombre del token" placeholder="Nombre (p. ej. Claude de Kevin)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Segmented
                aria-label="Qué puede consultar"
                options={[
                  { id: "vault" as const, label: "Solo el vault" },
                  { id: "eos" as const, label: "Vault + EOS completo" },
                ]}
                value={scope}
                onChange={setScope}
              />
              <p className="text-xs text-muted">
                {scope === "vault"
                  ? "Buscar, leer y listar notas del vault."
                  : "Además: Rocks, Scorecard, indicadores de carrera, Issues, To-Dos, V/TO, organigrama, reuniones L10 y agenda (lo que tu rol pueda ver)."}
              </p>
              <AppCheckbox checked={write} disabled={!info?.canWrite} onChange={(e) => setWrite(e.target.checked)}>
                <span className="text-sm">
                  Permitir que Claude cree y edite {scope === "eos" ? "(notas, Issues, To-Dos, estado de Rocks y valores del Scorecard)" : "(notas)"}
                </span>
              </AppCheckbox>
              <Button
                variant="primary"
                className="self-start"
                isPending={pending}
                onPress={() =>
                  start(async () => {
                    const r = await createTokenAction({ label, scope, canWrite: write }).catch(() => ({ ok: false, message: STALE, token: undefined }));
                    setMessage(r);
                    if (r.token) setCreated(r.token);
                    load();
                  })
                }
              >
                Generar token
              </Button>
            </section>

            <section className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">2. Copia la URL del conector</h3>
              {url ? (
                <>
                  <CopyField value={url} label="URL del conector" />
                  <p className="rounded-lg bg-yellow-bg px-3 py-2 text-xs text-yellow">
                    Cópiala ahora: por seguridad no se vuelve a mostrar. Quien tenga esta URL puede consultar con tus permisos; si se comparte por
                    error, revócala abajo.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">Aparece aquí al generar un token.</p>
              )}
            </section>

            <section className="flex flex-col gap-1 rounded-xl border border-border p-3 text-sm">
              <h3 className="font-semibold">3. Pégala en Claude</h3>
              <p>
                <b>claude.ai o Claude Desktop:</b> Ajustes → Conectores → <i>Agregar conector personalizado</i> → pega la URL → Agregar. Luego, en
                el chat, activa el conector desde el menú de herramientas.
              </p>
              <p>
                <b>Claude Code:</b>
              </p>
              <CopyField value={`claude mcp add --transport http eos ${url ?? `${info?.base ?? ""}/api/mcp/<token>`}`} label="Comando para Claude Code" />
            </section>

            <section className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">4. Consultor IA (opcional)</h3>
              <p className="text-xs text-muted">
                Si tienes un consultor hecho en Claude (un artefacto que usa este conector), pega su enlace y aparecerá el botón “Preguntar a la IA
                (Claude)” en el vault.
              </p>
              <div className="flex gap-2">
                <Input aria-label="Enlace del consultor" placeholder="https://claude.ai/…" value={consultant} onChange={(e) => setConsultant(e.target.value)} className="min-w-0 flex-1" disabled={!info?.canWrite} />
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={!info?.canWrite || pending}
                  onPress={() => start(async () => setMessage(await setConsultantUrlAction(consultant).catch(() => ({ ok: false, message: STALE }))))}
                >
                  Guardar
                </Button>
              </div>
            </section>

            {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}>{message.message}</p>}

            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Tokens del equipo ({active.length} activos)</h3>
              {info?.tokens.length === 0 && <p className="text-xs text-muted">Todavía no hay tokens.</p>}
              <ul className="flex flex-col gap-1">
                {info?.tokens.map((t) => (
                  <li key={t.id} className={`flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs ${t.revoked_at ? "opacity-50" : ""}`}>
                    <span className="font-medium">{t.label}</span>
                    <span className="font-mono text-muted">{t.prefix}…</span>
                    <Chip size="sm" variant="soft" color={t.scope === "eos" ? "accent" : "default"}>
                      {t.scope === "eos" ? "Vault + EOS" : "Solo vault"}
                    </Chip>
                    <Chip size="sm" variant="soft" color={t.can_write ? "warning" : "default"}>
                      {t.can_write ? "Lectura y escritura" : "Solo lectura"}
                    </Chip>
                    <span className="text-muted">
                      {t.user_name} · creado {WHEN.format(new Date(t.created_at))} ·{" "}
                      {t.last_used_at ? `último uso ${WHEN.format(new Date(t.last_used_at))} (${t.use_count})` : "sin usar"}
                      {t.revoked_at ? " · revocado" : ""}
                    </span>
                    {!t.revoked_at && (info.isAdmin || t.user_id === info.userId) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2 text-xs text-red"
                        onPress={() =>
                          start(async () => {
                            setMessage(await revokeTokenAction(t.id).catch(() => ({ ok: false, message: STALE })));
                            load();
                          })
                        }
                      >
                        Revocar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
