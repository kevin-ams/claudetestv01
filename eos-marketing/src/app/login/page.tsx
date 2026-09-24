import Link from "next/link";
import { redirect } from "next/navigation";
import { countUsers, isUserInTeam } from "@/lib/domain/users";
import { getSession } from "@/lib/auth/session";
import { Card } from "@heroui/react";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session && (await isUserInTeam(session.userId, session.teamId))) redirect("/");

  const existing = await countUsers();
  if (existing === 0) {
    redirect("/setup");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-4">
        <Card.Header>
          <Card.Title className="text-xl font-bold">Iniciar sesión</Card.Title>
          <Card.Description>
            Entra a tu sistema EOS: V/TO, Rocks, Scorecard, Issues, To-Dos y la Reunión Level 10.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <LoginForm />
        </Card.Content>
        <Card.Footer className="text-xs text-muted">
          <span>
            ¿Primera vez usando la app?{" "}
            <Link href="/setup" className="font-medium text-primary underline">
              Configura tu equipo
            </Link>
          </span>
        </Card.Footer>
      </Card>
    </div>
  );
}
