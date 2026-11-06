import { Card, Chip } from "@heroui/react";

/** Base de conocimiento (Vault) de toda la organización. Se construye en la Etapa 3. */
export default function ConocimientoPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Conocimiento</h1>
        <Chip size="sm" variant="soft" color="warning">
          Premium
        </Chip>
      </div>
      <Card className="flex flex-col gap-2 p-6">
        <p className="font-medium">El vault de la organización está en construcción.</p>
        <p className="text-sm text-muted">
          Aquí vivirán los procesos, documentos y la información de carreras como notas enlazadas entre sí: editor con
          [[enlaces]], búsqueda por palabras y por significado, conversor de PDF a nota, vista de grafo y conexión con Claude.
        </p>
      </Card>
    </div>
  );
}
