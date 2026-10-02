import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { listOptions } from "@/lib/domain/editorial";
import { OptionsEditor } from "@/components/editorial/options-editor";
import { SettingsHeader } from "../settings-header";

export default async function ListasPage() {
  const session = await getSession();
  if (!session) return null;
  const [options, calendario, coberturas] = await Promise.all([
    listOptions(session.teamId),
    canEdit("calendario"),
    canEdit("coberturas"),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Listas de contenido"
        description="Opciones predefinidas de los desplegables del Calendario editorial y del Control de coberturas. Quitar una opción no cambia las piezas que ya la usan."
      />
      {calendario || coberturas ? (
        <>
          <OptionsEditor options={options} kinds={["facultad"]} title="Facultades e institutos" defaultOpen />
          {calendario && (
            <OptionsEditor options={options} kinds={["pilar", "estado", "frente"]} title="Calendario editorial" defaultOpen />
          )}
          {coberturas && (
            <OptionsEditor options={options} kinds={["cob_tipo", "cob_estado", "cob_paquete"]} title="Control de coberturas" defaultOpen />
          )}
        </>
      ) : (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Tu rol no puede editar el Calendario editorial ni el Control de coberturas.
        </p>
      )}
    </div>
  );
}
