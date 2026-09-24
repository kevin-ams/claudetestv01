import { Card, Input, TextArea } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getVTO } from "@/lib/domain/vto";
import { EditableSection } from "@/components/editable-section";
import {
  saveCoreValues,
  saveCoreFocus,
  saveTenYearTarget,
  saveMarketingStrategy,
  saveThreeYearPicture,
  saveOneYearPlan,
} from "./actions";

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0)
    return <p className="text-sm text-muted">Sin definir todavía.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="text-sm">{value?.trim() ? value : "Sin definir todavía."}</p>
    </div>
  );
}

export default async function VTOPage() {
  const session = await getSession();
  if (!session) return null;
  const vto = await getVTO(session.teamId);

  if (!vto) {
    return <p className="text-sm text-muted">No se encontró el V/TO de tu equipo.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Vision/Traction Organizer (V/TO)</h1>
        <p className="text-sm text-muted">
          El documento de una página que resume hacia dónde va tu empresa y cómo va a llegar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-6">
          <h2 className="text-lg font-bold text-primary">VISIÓN</h2>

          <EditableSection
            title="Valores Centrales"
            action={saveCoreValues}
            view={<Bullets items={vto.core_values ?? []} />}
            editForm={
              <TextArea fullWidth
                name="coreValues"
                className="min-h-28"
                placeholder={"Un valor por línea"}
                defaultValue={(vto.core_values ?? []).join("\n")}
              />
            }
          />

          <EditableSection
            title="Enfoque Central"
            subtitle="Propósito/Causa/Pasión y Nicho"
            action={saveCoreFocus}
            view={
              <div className="flex flex-col gap-3">
                <Field label="Propósito / Causa / Pasión" value={vto.core_focus?.purpose} />
                <Field label="Nicho" value={vto.core_focus?.niche} />
              </div>
            }
            editForm={
              <>
                <TextArea fullWidth
                  name="purpose"
                  className="min-h-20"
                  placeholder="Propósito / Causa / Pasión"
                  defaultValue={vto.core_focus?.purpose ?? ""}
                />
                <TextArea fullWidth
                  name="niche"
                  className="min-h-16"
                  placeholder="Nicho"
                  defaultValue={vto.core_focus?.niche ?? ""}
                />
              </>
            }
          />

          <EditableSection
            title="Meta a 10 años"
            action={saveTenYearTarget}
            view={
              <p className="text-sm">
                {vto.ten_year_target?.trim() ? vto.ten_year_target : "Sin definir todavía."}
              </p>
            }
            editForm={
              <TextArea fullWidth
                name="tenYearTarget"
                className="min-h-24"
                defaultValue={vto.ten_year_target ?? ""}
              />
            }
          />

          <EditableSection
            title="Estrategia de Mercadeo"
            subtitle="Mercado objetivo, 3 diferenciadores, proceso comprobado y garantía"
            action={saveMarketingStrategy}
            view={
              <div className="flex flex-col gap-3">
                <Field label="Mercado objetivo" value={vto.marketing_strategy?.target_market} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Nuestros 3 diferenciadores (Three Uniques)
                  </p>
                  <Bullets items={vto.marketing_strategy?.three_uniques ?? []} />
                </div>
                <Field label="Proceso comprobado" value={vto.marketing_strategy?.proven_process} />
                <Field label="Garantía" value={vto.marketing_strategy?.guarantee} />
              </div>
            }
            editForm={
              <>
                <TextArea fullWidth
                  name="targetMarket"
                  className="min-h-16"
                  placeholder="Mercado objetivo (target market / list)"
                  defaultValue={vto.marketing_strategy?.target_market ?? ""}
                />
                <TextArea fullWidth
                  name="threeUniques"
                  className="min-h-20"
                  placeholder={"Un diferenciador por línea"}
                  defaultValue={(vto.marketing_strategy?.three_uniques ?? []).join("\n")}
                />
                <TextArea fullWidth
                  name="provenProcess"
                  className="min-h-16"
                  placeholder="Proceso comprobado"
                  defaultValue={vto.marketing_strategy?.proven_process ?? ""}
                />
                <TextArea fullWidth
                  name="guarantee"
                  className="min-h-16"
                  placeholder="Garantía"
                  defaultValue={vto.marketing_strategy?.guarantee ?? ""}
                />
              </>
            }
          />

          <EditableSection
            title="Imagen a 3 años"
            action={saveThreeYearPicture}
            view={
              <div className="flex flex-col gap-3">
                <Field label="Fecha futura" value={vto.three_year_picture?.future_date} />
                <Field label="Ingresos" value={vto.three_year_picture?.revenue} />
                <Field label="Utilidad" value={vto.three_year_picture?.profit} />
                <Field label="Medibles" value={vto.three_year_picture?.measurables} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    ¿Cómo se ve?
                  </p>
                  <Bullets items={vto.three_year_picture?.looks_like ?? []} />
                </div>
              </div>
            }
            editForm={
              <>
                <Input fullWidth
                  name="futureDate"
                  placeholder="Fecha futura (ej. 31 dic 2028)"
                  defaultValue={vto.three_year_picture?.future_date ?? ""}
                />
                <Input fullWidth
                  name="revenue"
                  placeholder="Ingresos"
                  defaultValue={vto.three_year_picture?.revenue ?? ""}
                />
                <Input fullWidth
                  name="profit"
                  placeholder="Utilidad"
                  defaultValue={vto.three_year_picture?.profit ?? ""}
                />
                <Input fullWidth
                  name="measurables"
                  placeholder="Medibles"
                  defaultValue={vto.three_year_picture?.measurables ?? ""}
                />
                <TextArea fullWidth
                  name="looksLike"
                  className="min-h-24"
                  placeholder={"Un punto por línea: ¿cómo se ve la empresa?"}
                  defaultValue={(vto.three_year_picture?.looks_like ?? []).join("\n")}
                />
              </>
            }
          />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-lg font-bold text-highlight">TRACCIÓN</h2>

          <EditableSection
            title="Plan a 1 año"
            action={saveOneYearPlan}
            view={
              <div className="flex flex-col gap-3">
                <Field label="Fecha futura" value={vto.one_year_plan?.future_date} />
                <Field label="Ingresos" value={vto.one_year_plan?.revenue} />
                <Field label="Utilidad" value={vto.one_year_plan?.profit} />
                <Field label="Medibles" value={vto.one_year_plan?.measurables} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Metas del año
                  </p>
                  <Bullets items={vto.one_year_plan?.goals ?? []} />
                </div>
              </div>
            }
            editForm={
              <>
                <Input fullWidth
                  name="futureDate"
                  placeholder="Fecha futura (ej. 31 dic 2026)"
                  defaultValue={vto.one_year_plan?.future_date ?? ""}
                />
                <Input fullWidth
                  name="revenue"
                  placeholder="Ingresos"
                  defaultValue={vto.one_year_plan?.revenue ?? ""}
                />
                <Input fullWidth
                  name="profit"
                  placeholder="Utilidad"
                  defaultValue={vto.one_year_plan?.profit ?? ""}
                />
                <Input fullWidth
                  name="measurables"
                  placeholder="Medibles"
                  defaultValue={vto.one_year_plan?.measurables ?? ""}
                />
                <TextArea fullWidth
                  name="goals"
                  className="min-h-24"
                  placeholder={"Una meta por línea"}
                  defaultValue={(vto.one_year_plan?.goals ?? []).join("\n")}
                />
              </>
            }
          />

          <Card className="block gap-0 p-5">
            <h3 className="font-semibold">Rocks trimestrales</h3>
            <p className="mt-1 text-sm text-muted">
              Los Rocks de la organización y de cada persona viven en su propio
              módulo, conectados a este mismo equipo.
            </p>
            <Link href="/rocks" className={`${buttonVariants({ variant: "outline" })} mt-3`}>
              Ir a Rocks →
            </Link>
          </Card>

          <Card className="block gap-0 p-5">
            <h3 className="font-semibold">Issues List</h3>
            <p className="mt-1 text-sm text-muted">
              La lista maestra de obstáculos y oportunidades de la organización
              vive en su propio módulo.
            </p>
            <Link href="/issues" className={`${buttonVariants({ variant: "outline" })} mt-3`}>
              Ir a Issues →
            </Link>
          </Card>
        </section>
      </div>
    </div>
  );
}
