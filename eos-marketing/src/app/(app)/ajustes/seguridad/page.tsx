import { Card } from "@heroui/react";
import { getAccess } from "@/lib/auth/access";
import { TIMEZONE } from "@/lib/config/shared";
import { accessReview } from "@/lib/security/access-review";
import { EVENT_LABEL, listSecurityEvents } from "@/lib/security/events";
import { getMfaMode } from "@/lib/security/mfa";
import { SettingsHeader } from "../settings-header";
import { MfaModeSwitch, ResetMfaButton } from "./security-controls";

const WHEN = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: TIMEZONE });
const fmt = (v: string | null) => (v ? WHEN.format(new Date(v)) : "Nunca");

/** Seguridad de la organización (ISO 27001 5.18, 8.5, 8.15): doble factor, revisión de accesos y bitácora. */
export default async function SeguridadPage() {
  const access = await getAccess();
  if (!access) return null;
  if (!access.isAdmin) {
    return <p className="mx-auto max-w-5xl text-sm text-muted">Solo los administradores ven la seguridad de la organización.</p>;
  }
  const teamId = access.session.teamId;
  const [mode, people, events] = await Promise.all([getMfaMode(teamId), accessReview(teamId), listSecurityEvents(teamId, 80)]);
  const withMfa = new Set(people.filter((p) => p.mfa).map((p) => p.user_id)).size;
  const total = new Set(people.map((p) => p.user_id)).size;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Seguridad"
        description="Doble factor, revisión de accesos y bitácora de eventos de seguridad de toda la organización. Revisa los accesos cada trimestre: quita a quien ya no lo necesita."
      />

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="font-semibold">Doble factor (código de una app)</h2>
          <p className="text-sm text-muted">
            Opcional: si está disponible, cada persona lo activa en <b>Mi perfil</b> con Google Authenticator, Microsoft Authenticator u otra app
            de códigos. Quien ya lo activó lo sigue usando aunque se apague la opción. {withMfa} de {total} persona(s) lo usan.
          </p>
        </div>
        <MfaModeSwitch mode={mode} canEdit={access.isPremium} />
        {!access.isPremium && <p className="text-xs text-muted">Solo el Administrador Premium cambia esta opción.</p>}
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Revisión de accesos</h2>
        <p className="mb-3 text-sm text-muted">Quién entra, con qué rol, cuándo fue su último acceso y si usa doble factor.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">Persona</th>
                <th className="pb-2 font-medium">Equipo y rol</th>
                <th className="pb-2 font-medium">Último acceso</th>
                <th className="pb-2 font-medium">Doble factor</th>
                <th className="pb-2 text-right font-medium">Tokens Claude</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={`${p.user_id}-${p.team_name}`} className="border-t border-border align-top">
                  <td className="py-2">
                    <p>{p.name}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </td>
                  <td className="py-2">
                    <p>{p.team_name}</p>
                    <p className={`text-xs ${p.is_premium || p.is_admin ? "font-semibold text-primary" : "text-muted"}`}>{p.role_name ?? "Usuario"}</p>
                  </td>
                  <td className="py-2 text-xs tabular-nums">{fmt(p.last_login_at)}</td>
                  <td className="py-2 text-xs">
                    {p.mfa ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-green">Activo</span>
                        {access.isPremium && <ResetMfaButton userId={p.user_id} name={p.name} />}
                      </span>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.active_tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Bitácora de seguridad</h2>
        <p className="mb-3 text-sm text-muted">
          Inicios de sesión, intentos fallidos, cambios de rol y de acceso, tokens, respaldos y exportaciones. Nadie puede editarla ni borrarla; se
          conserva un año.
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay eventos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Cuándo</th>
                  <th className="pb-2 font-medium">Evento</th>
                  <th className="pb-2 font-medium">Persona</th>
                  <th className="pb-2 font-medium">Detalle</th>
                  <th className="pb-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const bad = e.type === "login_failed" || e.type === "login_locked" || e.type === "mfa_failed";
                  return (
                    <tr key={e.id} className="border-t border-border align-top">
                      <td className="py-1.5 text-xs tabular-nums">{WHEN.format(new Date(e.created_at))}</td>
                      <td className={`py-1.5 ${bad ? "text-red" : ""}`}>{EVENT_LABEL[e.type] ?? e.type}</td>
                      <td className="py-1.5 text-xs">
                        {e.user_name ?? e.email ?? "—"}
                        {e.actor_name && e.actor_name !== e.user_name && <span className="text-muted"> · por {e.actor_name}</span>}
                      </td>
                      <td className="py-1.5 text-xs text-muted">{e.detail}</td>
                      <td className="py-1.5 font-mono text-[11px] text-muted">{e.ip ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
