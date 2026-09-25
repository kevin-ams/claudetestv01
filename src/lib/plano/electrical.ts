import { getCatalogItem } from "./catalog";
import type { Plan, PlanItem } from "./types";
import { newId } from "./util";

/** Cables rarely run in a straight line: extra routing factor + slack (m). */
const ROUTE_FACTOR = 1.2;
const SLACK = 0.5;
export const EXTENSION_SIZES = [3, 5, 10, 15, 20, 25, 30, 50];

export function isSource(item: PlanItem) {
  return !!item.source;
}

export function needsPower(item: PlanItem) {
  return !item.source && (item.watts ?? 0) > 0;
}

export function distance(a: PlanItem, b: PlanItem) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function cableRun(a: PlanItem, b: PlanItem) {
  return distance(a, b) * ROUTE_FACTOR + SLACK;
}

export function recommendedExtension(missing: number) {
  return EXTENSION_SIZES.find((s) => s >= missing) ?? Math.ceil(missing / 5) * 5;
}

export interface SourceReport {
  item: PlanItem;
  parent?: PlanItem;
  depth: number;
  /** Total load drawn through this source, including chained sources (W). */
  load: number;
  amps: number;
  /** Safe continuous capacity (W). */
  capacity: number;
  socketsUsed: number;
  children: PlanItem[];
  overloaded: boolean;
  overSockets: boolean;
  /** Source is a strip/extension that isn't plugged anywhere. */
  floating: boolean;
}

export interface CableIssue {
  item: PlanItem;
  source: PlanItem;
  run: number;
  cable: number;
  extension: number;
}

export interface ElectricalReport {
  totalWatts: number;
  totalAmps: number;
  devices: PlanItem[];
  unpowered: PlanItem[];
  sources: SourceReport[];
  cableIssues: CableIssue[];
  /** Wall circuits needed for the total load under the safety rule. */
  circuitsNeeded: number;
  circuitCapacity: number;
  /** Sockets needed if every device were plugged directly. */
  plugsNeeded: number;
  cycles: PlanItem[];
}

function sourceAncestors(item: PlanItem, byId: Map<string, PlanItem>) {
  const seen = new Set<string>();
  let cur = item.powerFrom ? byId.get(item.powerFrom) : undefined;
  while (cur) {
    if (seen.has(cur.id)) return { chain: seen, cycle: true };
    seen.add(cur.id);
    cur = cur.powerFrom ? byId.get(cur.powerFrom) : undefined;
  }
  return { chain: seen, cycle: false };
}

export function analyze(plan: Plan): ElectricalReport {
  const { voltage, safety, circuitAmps } = plan.electrical;
  const items = plan.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const devices = items.filter(needsPower);
  const sources = items.filter(isSource);

  const cycles = sources.filter((s) => sourceAncestors(s, byId).cycle);
  const cycleIds = new Set(cycles.map((c) => c.id));

  const children = new Map<string, PlanItem[]>();
  for (const it of items) {
    if (!it.powerFrom || !byId.has(it.powerFrom)) continue;
    if (!needsPower(it) && !isSource(it)) continue;
    const list = children.get(it.powerFrom) ?? [];
    list.push(it);
    children.set(it.powerFrom, list);
  }

  const loadCache = new Map<string, number>();
  const loadOf = (it: PlanItem): number => {
    if (!isSource(it)) return it.watts ?? 0;
    if (cycleIds.has(it.id)) return 0;
    const cached = loadCache.get(it.id);
    if (cached !== undefined) return cached;
    const l = (children.get(it.id) ?? []).reduce((sum, c) => sum + loadOf(c), 0);
    loadCache.set(it.id, l);
    return l;
  };

  const depthOf = (it: PlanItem) =>
    cycleIds.has(it.id) ? 0 : sourceAncestors(it, byId).chain.size;

  const sourceReports: SourceReport[] = sources.map((s) => {
    const load = loadOf(s);
    const capacity = s.source!.amps * voltage * safety;
    const kids = children.get(s.id) ?? [];
    const parent = s.powerFrom ? byId.get(s.powerFrom) : undefined;
    return {
      item: s,
      parent,
      depth: depthOf(s),
      load,
      amps: load / voltage,
      capacity,
      socketsUsed: kids.length,
      children: kids,
      overloaded: load > capacity,
      overSockets: kids.length > s.source!.sockets,
      floating:
        !parent && s.source!.kind !== "toma" && s.source!.kind !== "generador",
    };
  });

  // Order: circuit roots first, each followed by its tree.
  const ordered: SourceReport[] = [];
  const visit = (r: SourceReport) => {
    ordered.push(r);
    sourceReports
      .filter((c) => c.parent?.id === r.item.id && !cycleIds.has(c.item.id))
      .forEach(visit);
  };
  sourceReports.filter((r) => !r.parent || cycleIds.has(r.item.id)).forEach(visit);

  const cableIssues: CableIssue[] = [];
  for (const it of items) {
    if (!it.powerFrom) continue;
    const src = byId.get(it.powerFrom);
    if (!src) continue;
    const cable = it.cable ?? getCatalogItem(it.type)?.cable ?? 2;
    const run = cableRun(it, src);
    if (run > cable) {
      cableIssues.push({ item: it, source: src, run, cable, extension: recommendedExtension(run - cable) });
    }
  }

  const totalWatts = devices.reduce((s, d) => s + (d.watts ?? 0), 0);
  const circuitCapacity = circuitAmps * voltage * safety;
  const unpowered = [
    ...devices.filter((d) => !d.powerFrom || !byId.has(d.powerFrom)),
  ];

  return {
    totalWatts,
    totalAmps: totalWatts / voltage,
    devices,
    unpowered,
    sources: ordered,
    cableIssues,
    circuitsNeeded: totalWatts > 0 ? Math.ceil(totalWatts / circuitCapacity) : 0,
    circuitCapacity,
    plugsNeeded: devices.length,
    cycles,
  };
}

/** Would plugging `item` into `target` create a loop? */
export function createsCycle(item: PlanItem, target: PlanItem, items: PlanItem[]) {
  if (item.id === target.id) return true;
  const byId = new Map(items.map((i) => [i.id, i]));
  const { chain } = sourceAncestors(target, byId);
  return chain.has(item.id);
}

/**
 * Plug every unconnected device (and floating strip) into the nearest source
 * that still has free sockets and capacity.
 */
export function autoConnect(plan: Plan, opts: { withinReach?: boolean } = {}): PlanItem[] {
  const { voltage, safety } = plan.electrical;
  const items = plan.items.map((i) => ({ ...i }));
  const byId = new Map(items.map((i) => [i.id, i]));
  const report = analyze({ ...plan, items });
  const load = new Map(report.sources.map((r) => [r.item.id, r.load]));
  const used = new Map(report.sources.map((r) => [r.item.id, r.socketsUsed]));

  const addLoad = (srcId: string, w: number) => {
    let cur: PlanItem | undefined = byId.get(srcId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      load.set(cur.id, (load.get(cur.id) ?? 0) + w);
      cur = cur.powerFrom ? byId.get(cur.powerFrom) : undefined;
    }
  };

  const fits = (src: PlanItem, w: number) => {
    let cur: PlanItem | undefined = src;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if ((load.get(cur.id) ?? 0) + w > cur.source!.amps * voltage * safety) return false;
      cur = cur.powerFrom ? byId.get(cur.powerFrom) : undefined;
    }
    return (used.get(src.id) ?? 0) < src.source!.sockets;
  };

  const connect = (it: PlanItem, w: number) => {
    const reach = it.cable ?? getCatalogItem(it.type)?.cable ?? 2;
    const candidates = items
      .filter((s) => s.source && !createsCycle(it, s, items))
      .filter((s) => !opts.withinReach || cableRun(it, s) <= reach)
      .sort((a, b) => distance(it, a) - distance(it, b));
    const target = candidates.find((s) => fits(s, w));
    if (!target) return;
    it.powerFrom = target.id;
    used.set(target.id, (used.get(target.id) ?? 0) + 1);
    addLoad(target.id, w);
  };

  // Floating strips first so devices can chain into them.
  for (const r of report.sources.filter((r) => r.floating)) {
    connect(byId.get(r.item.id)!, r.load);
  }
  for (const d of items.filter((i) => needsPower(i) && (!i.powerFrom || !byId.has(i.powerFrom)))) {
    connect(d, d.watts ?? 0);
  }
  return items;
}

function sourceFromCatalog(type: string, x: number, y: number, n: number): PlanItem {
  const c = getCatalogItem(type)!;
  return {
    id: newId(),
    type,
    x,
    y,
    rotation: 0,
    w: c.w,
    h: c.h,
    label: `${type === "toma" ? "Toma" : type === "regleta" ? "Regleta" : c.name} ${n}`,
    color: c.color ?? "#888",
    notes: "Sugerido automáticamente",
    source: { ...c.source! },
    cable: c.cable,
  };
}

/**
 * Proposes a power distribution: groups unconnected devices by proximity,
 * drops a power strip at the center of each group and routes each strip
 * to the nearest wall outlet (creating outlets on the nearest wall if needed).
 */
export function suggestDistribution(plan: Plan): PlanItem[] {
  const { voltage, safety, circuitAmps, socketsPerOutlet } = plan.electrical;
  const { width, depth } = plan.stage;
  let items = autoConnect(plan, { withinReach: true });
  const pending = items.filter((i) => needsPower(i) && !i.powerFrom);
  if (pending.length === 0) return items;

  const stripSpec = getCatalogItem("regleta")!.source!;
  const stripCap = Math.min(stripSpec.amps, circuitAmps) * voltage * safety;
  const totalW = pending.reduce((s, d) => s + (d.watts ?? 0), 0);
  const minK = Math.min(
    pending.length,
    Math.max(1, Math.ceil(totalW / stripCap), Math.ceil(pending.length / stripSpec.sockets)),
  );
  // Add groups until every device reaches its strip with its own cable (+1 m slack).
  let centers: { x: number; y: number }[] = [];
  let assign: number[] = [];
  for (let k = minK; k <= pending.length; k++) {
    ({ centers, assign } = kmeans(pending, k));
    const reachable = pending.every((p, j) => {
      const c = centers[assign[j]];
      const run = Math.hypot(p.x - c.x, p.y - c.y) * ROUTE_FACTOR + SLACK;
      return run <= (p.cable ?? getCatalogItem(p.type)?.cable ?? 2) + 1;
    });
    if (reachable) break;
  }

  const newItems: PlanItem[] = [];
  let stripN = items.filter((i) => i.type === "regleta").length;
  let outletN = items.filter((i) => i.type === "toma").length;

  centers.forEach((c, i) => {
    const members = pending
      .filter((_, j) => assign[j] === i)
      .sort((a, b) => (b.watts ?? 0) - (a.watts ?? 0));
    let strip: PlanItem | undefined;
    let stripLoad = 0;
    let stripUsed = 0;
    for (const m of members) {
      const w = m.watts ?? 0;
      if (!strip || stripUsed >= stripSpec.sockets || stripLoad + w > stripCap) {
        const offset = newItems.filter((n) => n.type === "regleta").length % 2 ? 0.3 : 0;
        strip = sourceFromCatalog(
          "regleta",
          clamp(c.x + offset, 0.2, width - 0.2),
          clamp(c.y + 0.25 + offset, 0.2, depth - 0.2),
          ++stripN,
        );
        newItems.push(strip);
        stripLoad = 0;
        stripUsed = 0;
      }
      m.powerFrom = strip.id;
      stripLoad += w;
      stripUsed++;
    }
  });

  // Route each new strip to a wall outlet: reuse a free existing one when it's
  // about as close as the nearest wall, otherwise add a new outlet there.
  const all = () => items.concat(newItems);
  const strips = newItems.slice();
  for (const strip of strips) {
    const p = nearestWallPoint(strip.x, strip.y, width, depth);
    const wallDist = Math.hypot(strip.x - p.x, strip.y - p.y);
    const stripLoad = all().filter((i) => i.powerFrom === strip.id).reduce((s, i) => s + (i.watts ?? 0), 0);
    const existing = all()
      .filter((o) => o.source?.kind === "toma")
      .filter((o) => all().filter((i) => i.powerFrom === o.id).length < o.source!.sockets)
      .filter((o) => {
        const load = all().filter((i) => i.powerFrom === o.id).reduce((s, i) => s + (i.source ? stripTotal(i, all()) : i.watts ?? 0), 0);
        return load + stripLoad <= o.source!.amps * voltage * safety;
      })
      .sort((a, b) => distance(strip, a) - distance(strip, b))[0];
    if (existing && distance(strip, existing) <= wallDist + 1.5) {
      strip.powerFrom = existing.id;
      continue;
    }
    const outlet = sourceFromCatalog("toma", p.x, p.y, ++outletN);
    outlet.rotation = p.rotation;
    outlet.source = { kind: "toma", amps: circuitAmps, sockets: socketsPerOutlet };
    newItems.push(outlet);
    strip.powerFrom = outlet.id;
  }

  items = items.concat(newItems);
  return items;
}

/** k-means with farthest-point initialisation (deterministic). */
function kmeans(points: PlanItem[], k: number) {
  const centers: { x: number; y: number }[] = [{ x: points[0].x, y: points[0].y }];
  while (centers.length < k) {
    let best = points[0];
    let bestD = -1;
    for (const p of points) {
      const d = Math.min(...centers.map((c) => Math.hypot(p.x - c.x, p.y - c.y)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centers.push({ x: best.x, y: best.y });
  }
  let assign: number[] = [];
  for (let iter = 0; iter < 20; iter++) {
    assign = points.map((p) => {
      let bi = 0;
      centers.forEach((c, i) => {
        if (Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(p.x - centers[bi].x, p.y - centers[bi].y)) bi = i;
      });
      return bi;
    });
    centers.forEach((c, i) => {
      const members = points.filter((_, j) => assign[j] === i);
      if (members.length) {
        c.x = members.reduce((s, m) => s + m.x, 0) / members.length;
        c.y = members.reduce((s, m) => s + m.y, 0) / members.length;
      }
    });
  }
  return { centers, assign };
}

function stripTotal(src: PlanItem, items: PlanItem[], depth = 0): number {
  if (depth > 20) return 0;
  return items
    .filter((i) => i.powerFrom === src.id)
    .reduce((s, i) => s + (i.source ? stripTotal(i, items, depth + 1) : i.watts ?? 0), 0);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function nearestWallPoint(x: number, y: number, width: number, depth: number) {
  const options = [
    { x, y: 0, d: y, rotation: 0 },
    { x, y: depth, d: depth - y, rotation: 180 },
    { x: 0, y, d: x, rotation: 270 },
    { x: width, y, d: width - x, rotation: 90 },
  ];
  const best = options.sort((a, b) => a.d - b.d)[0];
  return { x: clamp(best.x, 0.1, width - 0.1), y: clamp(best.y, 0.1, depth - 0.1), rotation: best.rotation };
}
