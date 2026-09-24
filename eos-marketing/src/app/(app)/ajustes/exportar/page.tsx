import { ExportPanel } from "@/components/export-button";
import { lastClosedWeek, shiftWeek } from "@/lib/utils/dates";
import { SettingsHeader } from "../settings-header";

export default function ExportarPage() {
  const to = lastClosedWeek();
  const from = shiftWeek(to, -11);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SettingsHeader
        title="Exportar datos"
        description="Descarga la información en Excel. El formato .xlsm es un libro habilitado para macros (sin macros incluidas); .xlsx es el formato normal."
      />
      <section className="card card--default flex flex-col gap-3 p-5">
        <div>
          <h2 className="font-semibold">Indicadores de carrera</h2>
          <p className="text-sm text-muted">
            Tres hojas: detalle semanal por carrera (leads, meta, consumo, presupuesto, % y costo por
            lead, con semáforo), resumen por responsable del rango y metas mensuales.
          </p>
        </div>
        <ExportPanel kind="indicadores" defaultFrom={from} defaultTo={to} />
      </section>
      <section className="card card--default flex flex-col gap-3 p-5">
        <div>
          <h2 className="font-semibold">Scorecard</h2>
          <p className="text-sm text-muted">
            Una fila por indicador y dueño, una columna por semana, con la meta y el promedio; las
            celdas llevan el color de si se cumplió la meta.
          </p>
        </div>
        <ExportPanel kind="scorecard" defaultFrom={from} defaultTo={to} />
      </section>
    </div>
  );
}
