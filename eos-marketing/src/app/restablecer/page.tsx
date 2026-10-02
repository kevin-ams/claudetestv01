import Link from "next/link";
import { Card } from "@heroui/react";
import { findValidToken } from "@/lib/domain/password-tokens";
import { ResetForm } from "./reset-form";

export default async function RestablecerPage({ searchParams }: PageProps<"/restablecer">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const valid = await findValidToken(value);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-4">
        <Card.Header>
          <Card.Title className="text-xl font-bold">{valid?.purpose === "invite" ? "Crea tu contraseña" : "Nueva contraseña"}</Card.Title>
          <Card.Description>
            {valid ? `Para ${valid.name} (${valid.email}). Mínimo 8 caracteres.` : "Este enlace venció o ya se usó."}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {valid ? (
            <ResetForm token={value} />
          ) : (
            <Link href="/recuperar" className="mt-4 inline-block font-medium text-primary underline">
              Pedir un enlace nuevo
            </Link>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
