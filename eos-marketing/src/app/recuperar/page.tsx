import Link from "next/link";
import { Card } from "@heroui/react";
import { RecoverForm } from "./recover-form";

export default function RecuperarPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-4">
        <Card.Header>
          <Card.Title className="text-xl font-bold">¿Olvidaste tu contraseña?</Card.Title>
          <Card.Description>Escribe tu correo y te enviamos un enlace para crear una nueva (vence en 1 hora).</Card.Description>
        </Card.Header>
        <Card.Content>
          <RecoverForm />
        </Card.Content>
        <Card.Footer className="text-xs text-muted">
          <Link href="/login" className="font-medium text-primary underline">
            Volver a iniciar sesión
          </Link>
        </Card.Footer>
      </Card>
    </div>
  );
}
