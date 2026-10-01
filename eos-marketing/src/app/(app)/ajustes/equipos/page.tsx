import { Card, Chip } from "@heroui/react";
import { getAccess } from "@/lib/auth/access";
import { getUserTeams } from "@/lib/domain/users";
import { SettingsHeader } from "../settings-header";
import { NewTeamForm, SwitchTeamButton } from "./team-forms";

export default async function TeamsPage() {
  const access = await getAccess();
  if (!access) return null;
  const teams = (await getUserTeams(access.session.userId)).filter((t) => !t.is_demo);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SettingsHeader
        title="Equipos"
        description="Cada equipo tiene sus propios indicadores, Rocks, To-Dos, Issues y reuniones. Puedes pertenecer a varios y cambiar entre ellos."
      />
      <Card>
        <Card.Header>
          <Card.Title>Tus equipos</Card.Title>
        </Card.Header>
        <Card.Content>
          <ul className="flex flex-col divide-y divide-border">
            {teams.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted">
                    {t.members} persona(s) · tu rol: {t.role_name ?? "Usuario"}
                  </p>
                </div>
                {t.id === access.session.teamId ? (
                  <Chip size="sm" color="accent" variant="soft">
                    Equipo actual
                  </Chip>
                ) : (
                  <SwitchTeamButton teamId={t.id} />
                )}
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>

      {access.isAdmin && <NewTeamForm />}

      <Card>
        <Card.Header>
          <Card.Title>Indicadores compartidos entre equipos</Card.Title>
          <Card.Description>
            En Scorecard › Gestionar indicadores, marca un indicador como &quot;Visible para otros equipos&quot; y elige
            con cuáles compartirlo. Esos equipos lo verán (solo lectura) en su Scorecard, en la sección &quot;De otros
            equipos&quot;.
          </Card.Description>
        </Card.Header>
      </Card>
    </div>
  );
}
