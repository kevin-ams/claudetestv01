import "server-only";
import type { Career } from "./types";
import type { CareerAcLink } from "./ac-sync";
import {
  FIELD_KEYS,
  NO_CAREER,
  NO_FACULTY,
  UNKNOWN,
  isConversionStageDefault,
  normKey,
  type DashDeal,
  type DashMeta,
  type DashSettings,
  type DealRecord,
  type FieldKey,
  type FieldMap,
  type FieldRef,
} from "./deals-shared";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Elige los campos de ActiveCampaign por su nombre cuando no se configuraron a mano. */
export function guessFieldMap(meta: Pick<DashMeta, "dealFields" | "contactFields">): FieldMap {
  const patterns: Record<FieldKey, RegExp> = {
    faculty: /facultad|faculty|unidad acad/i,
    utm_source: /utm.?source/i,
    utm_medium: /utm.?medium/i,
    utm_term: /utm.?term/i,
    utm_campaign: /utm.?campa/i,
    lead_classification: /clasifica|classification|calificaci|tipo de lead|lead.?type/i,
  };
  const find = (re: RegExp): FieldRef => {
    const deal = meta.dealFields.find((f) => re.test(f.label) || re.test(f.key));
    if (deal) return { source: "deal", id: deal.id };
    const contact = meta.contactFields.find((f) => re.test(f.label) || re.test(f.key));
    return contact ? { source: "contact", id: contact.id } : null;
  };
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, find(patterns[k])])) as FieldMap;
}

export function effectiveFieldMap(settings: DashSettings, meta: DashMeta): FieldMap {
  return settings.fieldMap ?? guessFieldMap(meta);
}

export function conversionKeys(settings: DashSettings, meta: DashMeta): string[] {
  if (settings.conversionStageKeys) return settings.conversionStageKeys;
  return [...new Set(meta.stages.filter((s) => isConversionStageDefault(s.title)).map((s) => s.key))];
}

export type CareerResolver = (deal: Pick<DealRecord, "pipelineId" | "careerValue">) => { career: Career | null };

/**
 * Carrera de la app para un trato: primero por el vínculo de Ajustes › Leads desde ActiveCampaign
 * (embudo + "Nombre de la Carrera"), luego por nombre igual.
 */
export function careerResolver(careers: Career[], links: CareerAcLink[]): CareerResolver {
  const byId = new Map(careers.map((c) => [c.id, c]));
  const byName = new Map(careers.map((c) => [normKey(c.name), c]));
  const linksByPipeline = new Map<string, CareerAcLink[]>();
  for (const l of links) {
    const list = linksByPipeline.get(l.pipeline_id) ?? [];
    list.push(l);
    linksByPipeline.set(l.pipeline_id, list);
  }
  return ({ pipelineId, careerValue }) => {
    const value = normKey(careerValue);
    const candidates = linksByPipeline.get(pipelineId) ?? [];
    const link =
      (value && candidates.find((l) => l.career_value && normKey(l.career_value) === value)) ||
      candidates.find((l) => !l.career_value);
    const career = (link && byId.get(link.career_id)) || (value ? byName.get(value) : undefined) || null;
    return { career };
  };
}

function fieldValue(d: DealRecord, ref: FieldRef): string {
  if (!ref) return "";
  const v = ref.source === "deal" ? d.dealFields?.[ref.id] : d.contactFields?.[ref.id];
  return (v ?? "").trim();
}

export function resolveDeals(
  records: DealRecord[],
  ctx: {
    meta: DashMeta;
    settings: DashSettings;
    resolveCareer: CareerResolver;
    timeZone: string;
    now: number;
  }
): DashDeal[] {
  const { meta, settings, resolveCareer, timeZone, now } = ctx;
  const map = effectiveFieldMap(settings, meta);
  const users = new Map(meta.users.map((u) => [u.id, u.name]));
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dim = (d: DealRecord, k: FieldKey) => fieldValue(d, map[k]) || UNKNOWN;

  return records.map((d) => {
    const { career } = resolveCareer(d);
    const careerName = career?.name ?? (d.careerValue.trim() || NO_CAREER);
    const faculty =
      career?.program ||
      settings.facultyByCareer[normKey(d.careerValue)] ||
      fieldValue(d, map.faculty) ||
      NO_FACULTY;
    const created = Date.parse(d.createdAt);
    const end = d.status === "open" ? now : Date.parse(d.closedAt ?? d.updatedAt ?? "") || now;
    const entered = Date.parse(d.stageEnteredAt ?? d.createdAt);
    return {
      id: d.id,
      title: d.title,
      contact: [d.contactName, d.contactEmail].filter(Boolean).join(" · "),
      status: d.status,
      value: d.value,
      pipelineId: d.pipelineId,
      stageId: d.stageId,
      owner: (d.ownerId && users.get(d.ownerId)) || "Sin asesor",
      career: careerName,
      faculty,
      linked: Boolean(career),
      createdAt: d.createdAt,
      createdDay: dayFmt.format(created),
      daysInStage: Math.max(0, (end - entered) / DAY),
      daysOpen: Math.max(0, (end - created) / DAY),
      hoursToFirstNote: d.firstNote ? Math.max(0, (Date.parse(d.firstNote.at) - created) / HOUR) : null,
      notesCount: d.notesCount,
      enriched: d.enriched,
      firstNote: d.firstNote?.text ?? null,
      firstNoteAt: d.firstNote?.at ?? null,
      lastNote: d.lastNote?.text ?? null,
      lastNoteAt: d.lastNote?.at ?? null,
      lastActivityAt: d.lastActivityAt,
      utmSource: dim(d, "utm_source"),
      utmMedium: dim(d, "utm_medium"),
      utmTerm: dim(d, "utm_term"),
      utmCampaign: dim(d, "utm_campaign"),
      classification: dim(d, "lead_classification"),
    };
  });
}
