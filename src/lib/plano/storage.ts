import type { Plan } from "./types";
import { emptyPlan, TEMPLATES } from "./util";

const PLANS_KEY = "plano-iluminacion:plans";
const CURRENT_KEY = "plano-iluminacion:current";

export function loadPlans(): Plan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    const plans = raw ? (JSON.parse(raw) as Plan[]) : [];
    return Array.isArray(plans) ? plans.map(normalizePlan) : [];
  } catch {
    return [];
  }
}

export function savePlan(plan: Plan) {
  try {
    const plans = loadPlans().filter((p) => p.id !== plan.id);
    plans.unshift(plan);
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    localStorage.setItem(CURRENT_KEY, plan.id);
  } catch {
    // Storage full or unavailable: the plan still lives in memory.
  }
}

export function deletePlan(id: string) {
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(loadPlans().filter((p) => p.id !== id)));
  } catch {}
}

export function loadInitialPlan(): Plan {
  const plans = loadPlans();
  let current: string | null = null;
  try {
    current = localStorage.getItem(CURRENT_KEY);
  } catch {}
  return plans.find((p) => p.id === current) ?? plans[0] ?? TEMPLATES[1].make();
}

/** Fills in fields missing from plans saved by older versions or imported files. */
export function normalizePlan(input: Partial<Plan>): Plan {
  const base = emptyPlan();
  return {
    ...base,
    ...input,
    id: input.id ?? base.id,
    stage: { ...base.stage, ...input.stage },
    electrical: { ...base.electrical, ...input.electrical },
    items: Array.isArray(input.items) ? input.items : [],
  };
}
