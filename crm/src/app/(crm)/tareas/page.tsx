import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Tareas"
      phase={1}
      description="Pendientes con fecha de vencimiento, ligados a contactos y negocios."
    />
  );
}
