import type { ReactNode } from "react";
import type { PlanItem } from "@/lib/plano/types";

/** SVG units per meter. */
export const PX = 100;

const STROKE = "#374151";
const SW = 1.2;

function Person({ w, h, color, hair, seated }: { w: number; h: number; color: string; hair?: boolean; seated?: boolean }) {
  const sh = Math.min(h, 32);
  const cy = seated ? h / 2 - sh / 2 : 0;
  const head = Math.min(w, sh) * 0.42;
  return (
    <g>
      {seated && (
        <>
          <rect x={-w * 0.42} y={cy - sh / 2 - 2} width={w * 0.84} height={sh + 6} rx={4} fill="#d1d5db" stroke={STROKE} strokeWidth={SW} />
          <rect x={-w * 0.3} y={-h / 2} width={w * 0.24} height={h - sh} rx={5} fill={color} stroke={STROKE} strokeWidth={SW} />
          <rect x={w * 0.06} y={-h / 2} width={w * 0.24} height={h - sh} rx={5} fill={color} stroke={STROKE} strokeWidth={SW} />
        </>
      )}
      <ellipse cx={0} cy={cy} rx={w / 2} ry={sh / 2} fill="url(#pl-body)" stroke={STROKE} strokeWidth={SW} />
      {hair && (
        <path
          d={`M ${-head * 1.25} ${cy - head * 0.2} Q ${-head * 1.4} ${cy + head * 1.3} ${-head * 0.4} ${cy + head * 1.1} L ${head * 0.4} ${cy + head * 1.1} Q ${head * 1.4} ${cy + head * 1.3} ${head * 1.25} ${cy - head * 0.2} Z`}
          fill="#4b5563"
          stroke={STROKE}
          strokeWidth={SW}
        />
      )}
      <path d={`M ${-head * 0.25} ${cy - head * 0.95} L 0 ${cy - head * 1.3} L ${head * 0.25} ${cy - head * 0.95}`} fill="#e5e7eb" stroke={STROKE} strokeWidth={SW} />
      <circle cx={0} cy={cy} r={head} fill="url(#pl-head)" stroke={STROKE} strokeWidth={SW} />
      <path d={`M ${-head * 0.7} ${cy - head * 0.4} Q 0 ${cy + head * 0.2} ${head * 0.7} ${cy - head * 0.4}`} fill="none" stroke="#1f2937" strokeWidth={0.8} opacity={0.6} />
    </g>
  );
}

function Guitar({ w, h, color }: { w: number; h: number; color: string }) {
  const r1 = w * 0.5;
  const r2 = w * 0.38;
  return (
    <g>
      <rect x={-w * 0.08} y={-h / 2} width={w * 0.16} height={h * 0.55} fill="#78350f" stroke={STROKE} strokeWidth={SW} />
      <circle cx={0} cy={h / 2 - r1} r={r1} fill={color} stroke={STROKE} strokeWidth={SW} />
      <circle cx={0} cy={h / 2 - r1 * 2 - r2 * 0.6} r={r2} fill={color} stroke={STROKE} strokeWidth={SW} />
      <circle cx={0} cy={h / 2 - r1 * 1.4} r={r2 * 0.35} fill="#1f2937" />
    </g>
  );
}

function Box({ w, h, fill, rx = 2, opacity }: { w: number; h: number; fill: string; rx?: number; opacity?: number }) {
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} fill={fill} stroke={STROKE} strokeWidth={SW} opacity={opacity} />;
}

function LightHead({ w, h, color }: { w: number; h: number; color: string }) {
  // Generic spotlight: body at the back, lens + barn doors at the front (-y).
  return (
    <g>
      <rect x={-w * 0.35} y={-h * 0.15} width={w * 0.7} height={h * 0.62} rx={3} fill="url(#pl-metal)" stroke={STROKE} strokeWidth={SW} />
      <rect x={-w * 0.12} y={h * 0.47} width={w * 0.24} height={h * 0.05} fill={color} stroke={STROKE} strokeWidth={SW} />
      <path d={`M ${-w * 0.35} ${-h * 0.15} L ${-w / 2} ${-h / 2} L ${w / 2} ${-h / 2} L ${w * 0.35} ${-h * 0.15} Z`} fill="#6b7280" stroke={STROKE} strokeWidth={SW} />
      <rect x={-w * 0.32} y={-h * 0.2} width={w * 0.64} height={h * 0.07} fill="#fef9c3" stroke={STROKE} strokeWidth={0.8} />
    </g>
  );
}

function LightStand({ r }: { r: number }) {
  return (
    <g stroke={STROKE} strokeWidth={SW} opacity={0.55}>
      {[90, 210, 330].map((a) => (
        <line key={a} x1={0} y1={0} x2={Math.cos((a * Math.PI) / 180) * r} y2={Math.sin((a * Math.PI) / 180) * r} />
      ))}
    </g>
  );
}

function polygon(n: number, r: number, rot = Math.PI / n) {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return `${Math.cos(a) * r},${Math.sin(a) * r}`;
  }).join(" ");
}

const XMAS_COLORS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#f97316", "#ec4899"];

export function ItemSymbol({ item }: { item: PlanItem }) {
  const w = item.w * PX;
  const h = item.h * PX;
  const c = item.color;
  let body: ReactNode;

  switch (item.type) {
    // ─── Personas
    case "persona":
    case "camarografo":
      body = <Person w={w} h={h} color={c} />;
      break;
    case "persona-pelo-largo":
      body = <Person w={w} h={h} color={c} hair />;
      break;
    case "persona-sentada":
      body = <Person w={w} h={h} color={c} seated />;
      break;
    case "musico":
      body = (
        <g>
          <Person w={w} h={h} color={c} />
          <g transform={`translate(${w * 0.05},${-h * 0.75}) rotate(-70)`}>
            <Guitar w={w * 0.45} h={w * 1.1} color="#b45309" />
          </g>
        </g>
      );
      break;

    // ─── Cámaras
    case "camara":
    case "camara-cine": {
      const cine = item.type === "camara-cine";
      body = (
        <g>
          <rect x={-w / 2} y={-h * 0.05} width={w} height={h * 0.55} rx={4} fill={c} stroke="#000" strokeWidth={SW} />
          <rect x={-w * 0.28} y={-h / 2} width={w * 0.56} height={h * 0.47} rx={2} fill="#111827" stroke="#000" strokeWidth={SW} />
          {[0.15, 0.25, 0.35].map((f) => (
            <line key={f} x1={-w * 0.28} x2={w * 0.28} y1={-h / 2 + h * f} y2={-h / 2 + h * f} stroke="#4b5563" strokeWidth={1} />
          ))}
          {cine && <rect x={-w * 0.45} y={-h / 2 - 2} width={w * 0.9} height={h * 0.08} fill="#1f2937" stroke="#000" strokeWidth={SW} />}
          <rect x={w * 0.12} y={h * 0.18} width={w * 0.3} height={h * 0.2} fill="#1e3a8a" />
          <circle cx={-w * 0.25} cy={h * 0.25} r={w * 0.08} fill="#374151" />
        </g>
      );
      break;
    }
    case "camara-tripode": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          {[90, 210, 330].map((a) => (
            <g key={a}>
              <line x1={0} y1={0} x2={Math.cos((a * Math.PI) / 180) * r} y2={Math.sin((a * Math.PI) / 180) * r} stroke="#4b5563" strokeWidth={2.5} />
              <circle cx={Math.cos((a * Math.PI) / 180) * r} cy={Math.sin((a * Math.PI) / 180) * r} r={2.5} fill="#1f2937" />
            </g>
          ))}
          <g transform="scale(0.9)">
            <rect x={-15} y={-2} width={30} height={19} rx={4} fill={c} stroke="#000" strokeWidth={SW} />
            <rect x={-8} y={-18} width={16} height={17} rx={2} fill="#111827" stroke="#000" strokeWidth={SW} />
            <rect x={4} y={4} width={9} height={7} fill="#1e3a8a" />
          </g>
        </g>
      );
      break;
    }
    case "ptz":
      body = (
        <g>
          <circle r={w / 2} fill={c} stroke={STROKE} strokeWidth={SW} />
          <rect x={-w * 0.18} y={-w / 2 - 3} width={w * 0.36} height={w * 0.5} rx={2} fill="#111827" />
          <circle r={w * 0.18} fill="#374151" />
        </g>
      );
      break;
    case "jib":
      body = (
        <g>
          <line x1={0} y1={-h / 2 + 10} x2={0} y2={h / 2 - 10} stroke={c} strokeWidth={Math.max(4, w * 0.12)} strokeLinecap="round" />
          <rect x={-w * 0.35} y={h / 2 - 22} width={w * 0.7} height={20} rx={3} fill="#1f2937" stroke="#000" strokeWidth={SW} />
          <g transform={`translate(0,${h / 2 - h * 0.3})`}>
            <LightStand r={w * 0.7} />
            <circle r={6} fill="#4b5563" stroke="#000" />
          </g>
          <rect x={-12} y={-h / 2} width={24} height={16} rx={3} fill="#111827" stroke="#000" strokeWidth={SW} />
          <rect x={-6} y={-h / 2 - 8} width={12} height={10} fill="#111827" />
        </g>
      );
      break;
    case "dolly":
      body = (
        <g>
          <line x1={-w * 0.3} y1={-h / 2} x2={-w * 0.3} y2={h / 2} stroke="#4b5563" strokeWidth={3} />
          <line x1={w * 0.3} y1={-h / 2} x2={w * 0.3} y2={h / 2} stroke="#4b5563" strokeWidth={3} />
          {Array.from({ length: Math.max(2, Math.floor(h / 25)) }, (_, i) => {
            const n = Math.max(2, Math.floor(h / 25));
            const y = -h / 2 + (h * (i + 0.5)) / n;
            return <line key={i} x1={-w * 0.4} x2={w * 0.4} y1={y} y2={y} stroke="#9ca3af" strokeWidth={2} />;
          })}
          <rect x={-w * 0.4} y={-w * 0.3} width={w * 0.8} height={w * 0.6} rx={3} fill={c} stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    case "monitor-cam":
      body = (
        <g>
          <Box w={w} h={h} fill={c} />
          <rect x={-w / 2 + 3} y={-h / 2 + 2} width={w - 6} height={3} fill="#60a5fa" />
        </g>
      );
      break;

    // ─── Luces
    case "fresnel":
    case "fresnel-led":
    case "backlight":
      body = <LightHead w={w} h={h} color={c} />;
      break;
    case "cob":
      body = (
        <g>
          <rect x={-w * 0.35} y={0} width={w * 0.7} height={h / 2} rx={4} fill="url(#pl-metal)" stroke={STROKE} strokeWidth={SW} />
          <path d={`M ${-w * 0.2} 0 L ${-w / 2} ${-h / 2} L ${w / 2} ${-h / 2} L ${w * 0.2} 0 Z`} fill="#d1d5db" stroke={STROKE} strokeWidth={SW} />
          <line x1={-w / 2} x2={w / 2} y1={-h / 2} y2={-h / 2} stroke="#fde68a" strokeWidth={3} />
        </g>
      );
      break;
    case "panel-led":
      body = (
        <g>
          <Box w={w} h={h} fill="#4b5563" />
          <rect x={-w / 2 + 2} y={-h / 2} width={w - 4} height={h * 0.35} fill="#fef9c3" />
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={-w / 2 + (w * (i + 0.5)) / 8} cy={h * 0.15} r={1.3} fill="#9ca3af" />
          ))}
        </g>
      );
      break;
    case "softbox":
    case "stripbox":
      body = (
        <g>
          <path d={`M ${-w * 0.15} ${h / 2} L ${-w / 2} ${-h / 2} L ${w / 2} ${-h / 2} L ${w * 0.15} ${h / 2} Z`} fill="url(#pl-soft)" stroke={STROKE} strokeWidth={SW} />
          <line x1={-w / 2} x2={w / 2} y1={-h / 2} y2={-h / 2} stroke="#fff" strokeWidth={3} />
          <rect x={-w * 0.12} y={h / 2 - 4} width={w * 0.24} height={10} rx={2} fill="#6b7280" stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    case "octabox": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <polygon points={polygon(8, r)} fill="url(#pl-soft)" stroke={STROKE} strokeWidth={SW} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = Math.PI / 8 + (i * Math.PI) / 4;
            return <line key={i} x1={0} y1={0} x2={Math.cos(a) * r} y2={Math.sin(a) * r} stroke="#9ca3af" strokeWidth={0.8} />;
          })}
          <circle r={r * 0.25} fill="#e5e7eb" stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    }
    case "beauty-dish": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <circle r={r} fill="url(#pl-soft)" stroke={STROKE} strokeWidth={SW} />
          <circle r={r * 0.7} fill="none" stroke="#9ca3af" strokeWidth={0.8} />
          <circle r={r * 0.28} fill="#d1d5db" stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    }
    case "par": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <rect x={-r * 0.9} y={-r * 0.2} width={r * 1.8} height={r * 1.2} rx={3} fill="#374151" stroke={STROKE} strokeWidth={SW} />
          <ellipse cx={0} cy={-r * 0.2} rx={r} ry={r * 0.45} fill={item.beamColor ?? "#fef9c3"} stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    }
    case "elipsoidal":
      body = (
        <g>
          <ellipse cx={0} cy={h * 0.25} rx={w / 2} ry={h * 0.25} fill="url(#pl-metal)" stroke={STROKE} strokeWidth={SW} />
          <rect x={-w * 0.3} y={-h / 2} width={w * 0.6} height={h * 0.5} rx={2} fill="#6b7280" stroke={STROKE} strokeWidth={SW} />
          <line x1={-w * 0.3} x2={w * 0.3} y1={-h / 2} y2={-h / 2} stroke="#fde68a" strokeWidth={3} />
        </g>
      );
      break;
    case "cabeza-movil": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={5} fill="#1f2937" stroke="#000" strokeWidth={SW} />
          <circle r={r * 0.7} fill="#4b5563" stroke="#000" strokeWidth={SW} />
          <circle cy={-r * 0.35} r={r * 0.3} fill="#fef08a" />
        </g>
      );
      break;
    }
    case "tubo-led":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill="#e5e7eb" stroke={STROKE} strokeWidth={SW} />
          <line x1={-w / 2 + h / 2} x2={w / 2 - h / 2} y1={0} y2={0} stroke={item.beamColor ?? "#fde68a"} strokeWidth={Math.max(2, h * 0.4)} strokeLinecap="round" />
        </g>
      );
      break;
    case "ring-light": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <circle r={r * 0.82} fill="none" stroke="#fef9c3" strokeWidth={r * 0.28} />
          <circle r={r * 0.82} fill="none" stroke={STROKE} strokeWidth={r * 0.36} strokeOpacity={0.25} />
          <circle r={r} fill="none" stroke={STROKE} strokeWidth={SW} />
          <circle r={r * 0.64} fill="none" stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    }
    case "fondo-luz":
      body = (
        <g>
          <Box w={w} h={h} fill="#4b5563" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={-w / 2 + 3 + (i * (w - 6)) / 4} y={-h / 2 + 2} width={(w - 6) / 4 - 3} height={h * 0.45} fill="#fef9c3" />
          ))}
        </g>
      );
      break;
    case "practica": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <circle cy={-r * 0.2} r={r * 0.7} fill="#fffbeb" stroke={STROKE} strokeWidth={SW} />
          <rect x={-r * 0.3} y={r * 0.4} width={r * 0.6} height={r * 0.55} fill="#9ca3af" stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;
    }
    case "lampara-pie": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <circle r={r} fill={c} stroke={STROKE} strokeWidth={SW} />
          <circle r={r * 0.35} fill="#fef3c7" stroke={STROKE} strokeWidth={0.8} />
        </g>
      );
      break;
    }
    case "navidad": {
      const n = Math.max(4, Math.round(w / 14));
      const pts = Array.from({ length: n + 1 }, (_, i) => ({ x: -w / 2 + (w * i) / n, y: (i % 2 ? 1 : -1) * h * 0.3 }));
      body = (
        <g>
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={c} strokeWidth={1.5} />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={Math.max(2.5, h * 0.25)} fill={item.beamColor ?? XMAS_COLORS[i % XMAS_COLORS.length]} stroke="#00000055" strokeWidth={0.6} />
          ))}
        </g>
      );
      break;
    }
    case "vela":
    case "vela-led": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <circle r={r} fill={c} stroke={STROKE} strokeWidth={SW} />
          <circle r={r * 0.35} fill="#f97316" />
          <circle r={r * 0.15} fill="#fde047" />
        </g>
      );
      break;
    }
    case "neon":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill="#1f2937" />
          <path
            d={`M ${-w / 2 + 4} 0 ${Array.from({ length: 6 }, (_, i) => `Q ${-w / 2 + ((i + 0.5) * (w - 8)) / 6 + 4} ${i % 2 ? h : -h} ${-w / 2 + ((i + 1) * (w - 8)) / 6 + 4} 0`).join(" ")}`}
            fill="none"
            stroke={item.beamColor ?? c}
            strokeWidth={2}
          />
        </g>
      );
      break;
    case "humo":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={4} />
          <rect x={-w * 0.1} y={-h / 2 - 5} width={w * 0.2} height={6} fill="#111827" />
          <text y={4} textAnchor="middle" fontSize={Math.min(12, h * 0.45)} fill="#fff">HUMO</text>
        </g>
      );
      break;

    // ─── Modificadores
    case "rebotador-oro":
    case "rebotador-plata":
    case "rebotador-blanco":
    case "reflector-5en1":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} stroke={STROKE} strokeWidth={SW} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="url(#pl-shine)" />
        </g>
      );
      break;
    case "bandera":
    case "cortador":
      body = <Box w={w} h={h} fill={c} rx={1} />;
      break;
    case "difusor":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} stroke="#6b7280" strokeWidth={2.5} />
          <line x1={-w / 2} x2={w / 2} y1={0} y2={0} stroke="#cbd5e1" strokeDasharray="4 3" />
        </g>
      );
      break;

    // ─── Instrumentos
    case "bateria": {
      const u = Math.min(w, h);
      const drum = (x: number, y: number, r: number, fill = "#e5e7eb") => (
        <circle cx={x} cy={y} r={r} fill={fill} stroke={STROKE} strokeWidth={SW} />
      );
      body = (
        <g>
          <rect x={-u * 0.13} y={-h / 2} width={u * 0.26} height={u * 0.36} rx={4} fill="#9ca3af" stroke={STROKE} strokeWidth={SW} />
          {drum(-u * 0.14, -h / 2 + u * 0.48, u * 0.1)}
          {drum(u * 0.14, -h / 2 + u * 0.48, u * 0.1)}
          {drum(u * 0.32, h * 0.1, u * 0.14)}
          {drum(-u * 0.22, h * 0.08, u * 0.1)}
          {drum(-w * 0.4, -h * 0.05, u * 0.1, "#eab308")}
          {drum(-w * 0.32, -h * 0.36, u * 0.13, "#eab308")}
          {drum(w * 0.36, -h * 0.34, u * 0.15, "#eab308")}
          {drum(0, h / 2 - u * 0.1, u * 0.09, "#4b5563")}
        </g>
      );
      break;
    }
    case "guitarra":
    case "bajo":
      body = <Guitar w={w} h={h} color={c} />;
      break;
    case "teclado":
      body = (
        <g>
          <Box w={w} h={h} fill={c} />
          <rect x={-w / 2 + 4} y={0} width={w - 8} height={h / 2 - 3} fill="#fff" />
          {Array.from({ length: Math.floor((w - 8) / 5) }, (_, i) => (
            <line key={i} x1={-w / 2 + 4 + i * 5} x2={-w / 2 + 4 + i * 5} y1={0} y2={h / 2 - 3} stroke="#9ca3af" strokeWidth={0.5} />
          ))}
        </g>
      );
      break;
    case "piano":
      body = (
        <path
          d={`M ${-w / 2} ${h / 2} L ${-w / 2} ${-h / 2 + w * 0.3} Q ${-w / 2} ${-h / 2} ${-w * 0.1} ${-h / 2} Q ${w * 0.2} ${-h / 2} ${w * 0.2} ${-h * 0.1} Q ${w * 0.2} ${h * 0.15} ${w / 2} ${h * 0.25} L ${w / 2} ${h / 2} Z`}
          fill={c}
          stroke="#000"
          strokeWidth={SW}
        />
      );
      break;
    case "amplificador":
    case "bocina":
      body = (
        <g>
          <Box w={w} h={h} fill={c} />
          <rect x={-w / 2 + 3} y={-h / 2} width={w - 6} height={h * 0.3} fill="#111827" />
          {item.type === "bocina" && <circle cy={h * 0.1} r={Math.min(w, h) * 0.25} fill="#4b5563" stroke="#111" />}
        </g>
      );
      break;
    case "monitor-piso":
      body = (
        <path d={`M ${-w / 2} ${h / 2} L ${-w * 0.38} ${-h / 2} L ${w * 0.38} ${-h / 2} L ${w / 2} ${h / 2} Z`} fill={c} stroke="#000" strokeWidth={SW} />
      );
      break;
    case "microfono": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <LightStand r={r} />
          <line x1={0} y1={0} x2={0} y2={-r} stroke={c} strokeWidth={2} />
          <circle cy={-r} r={4} fill="#111827" />
        </g>
      );
      break;
    }
    case "microfono-boom":
      body = (
        <g>
          <line x1={0} y1={h / 2} x2={0} y2={-h / 2 + 8} stroke={c} strokeWidth={Math.max(2, w * 0.4)} strokeLinecap="round" />
          <rect x={-4} y={-h / 2} width={8} height={14} rx={3} fill="#111827" />
        </g>
      );
      break;
    case "consola":
      body = (
        <g>
          <Box w={w} h={h} fill={c} />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={-w / 2 + ((i + 0.5) * w) / 8} x2={-w / 2 + ((i + 0.5) * w) / 8} y1={-h * 0.3} y2={h * 0.3} stroke="#9ca3af" strokeWidth={1.5} />
          ))}
        </g>
      );
      break;
    case "atril":
      body = (
        <g>
          <LightStand r={h / 2} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.3} fill={c} stroke={STROKE} strokeWidth={SW} />
        </g>
      );
      break;

    // ─── Escenografía
    case "fondo":
    case "chroma":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} stroke={STROKE} strokeWidth={SW} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.35} fill="#00000014" />
          {[-w / 2, w / 2].map((x) => (
            <g key={x} transform={`translate(${x},0)`}>
              <LightStand r={h * 0.8} />
              <circle r={3} fill="#374151" />
            </g>
          ))}
        </g>
      );
      break;
    case "cortina": {
      const n = Math.max(4, Math.round(w / 16));
      body = (
        <path
          d={`M ${-w / 2} 0 ${Array.from({ length: n }, (_, i) => `Q ${-w / 2 + ((i + 0.5) * w) / n} ${i % 2 ? h / 2 : -h / 2} ${-w / 2 + ((i + 1) * w) / n} 0`).join(" ")}`}
          fill="none"
          stroke={c}
          strokeWidth={Math.max(3, h * 0.5)}
          strokeLinecap="round"
        />
      );
      break;
    }
    case "pared":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={0} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="url(#pl-hatch)" />
        </g>
      );
      break;
    case "sofa":
    case "silla": {
      const back = Math.max(6, h * 0.22);
      const arm = item.type === "sofa" ? Math.max(6, w * 0.08) : 0;
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={6} />
          <rect x={-w / 2} y={h / 2 - back} width={w} height={back} rx={4} fill="#00000030" stroke={STROKE} strokeWidth={SW} />
          {arm > 0 && (
            <>
              <rect x={-w / 2} y={-h / 2} width={arm} height={h} rx={4} fill="#00000022" stroke={STROKE} strokeWidth={SW} />
              <rect x={w / 2 - arm} y={-h / 2} width={arm} height={h} rx={4} fill="#00000022" stroke={STROKE} strokeWidth={SW} />
            </>
          )}
        </g>
      );
      break;
    }
    case "banco":
    case "mesa-redonda": {
      body = <ellipse rx={w / 2} ry={h / 2} fill={c} stroke={STROKE} strokeWidth={SW} />;
      break;
    }
    case "mesa":
      body = <Box w={w} h={h} fill={c} rx={4} />;
      break;
    case "caja":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={1} />
          <path d={`M ${-w / 2} ${-h / 2} L ${w / 2} ${h / 2} M ${w / 2} ${-h / 2} L ${-w / 2} ${h / 2}`} stroke="#a8a29e" strokeWidth={0.8} />
        </g>
      );
      break;
    case "planta": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i * 2 * Math.PI) / 7;
            return <ellipse key={i} cx={Math.cos(a) * r * 0.5} cy={Math.sin(a) * r * 0.5} rx={r * 0.5} ry={r * 0.28} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * r * 0.5} ${Math.sin(a) * r * 0.5})`} fill={c} stroke="#14532d" strokeWidth={0.8} />;
          })}
          <circle r={r * 0.25} fill="#78350f" />
        </g>
      );
      break;
    }
    case "arbol-navidad": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <polygon points={polygon(10, r, 0)} fill={c} stroke="#14532d" strokeWidth={SW} />
          <polygon points={polygon(8, r * 0.68, 0.3)} fill="#15803d" stroke="#14532d" strokeWidth={0.8} />
          <polygon points={polygon(6, r * 0.38, 0.6)} fill="#16a34a" stroke="#14532d" strokeWidth={0.8} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i * 2 * Math.PI) / 10 + 0.3;
            const rr = i % 2 ? r * 0.8 : r * 0.5;
            return <circle key={i} cx={Math.cos(a) * rr} cy={Math.sin(a) * rr} r={2.8} fill={XMAS_COLORS[i % XMAS_COLORS.length]} />;
          })}
          <polygon points={polygon(5, r * 0.14, -Math.PI / 2)} fill="#facc15" />
        </g>
      );
      break;
    }
    case "alfombra":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} opacity={0.55} stroke={STROKE} strokeWidth={SW} />
          <rect x={-w / 2 + 8} y={-h / 2 + 8} width={Math.max(0, w - 16)} height={Math.max(0, h - 16)} fill="none" stroke="#00000033" strokeWidth={2} />
        </g>
      );
      break;
    case "tarima":
      body = (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} opacity={0.6} stroke={STROKE} strokeWidth={SW} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="url(#pl-hatch)" />
        </g>
      );
      break;
    case "tv":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={1} />
          <line x1={-w / 2 + 2} x2={w / 2 - 2} y1={-h / 2 + 1} y2={-h / 2 + 1} stroke="#60a5fa" strokeWidth={2} />
        </g>
      );
      break;
    case "estante":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={1} />
          {Array.from({ length: Math.max(1, Math.floor(w / 40)) }, (_, i) => {
            const n = Math.max(1, Math.floor(w / 40));
            return <line key={i} x1={-w / 2 + ((i + 1) * w) / (n + 1)} x2={-w / 2 + ((i + 1) * w) / (n + 1)} y1={-h / 2} y2={h / 2} stroke="#451a03" strokeWidth={1} />;
          })}
        </g>
      );
      break;
    case "puerta":
      body = (
        <g>
          <line x1={-w / 2} y1={h / 2} x2={w / 2} y2={h / 2} stroke={STROKE} strokeWidth={4} />
          <line x1={-w / 2} y1={h / 2} x2={-w / 2} y2={-h / 2} stroke={c} strokeWidth={3} />
          <path d={`M ${-w / 2} ${-h / 2} A ${w} ${h} 0 0 1 ${w / 2} ${h / 2}`} fill="none" stroke={STROKE} strokeDasharray="4 3" strokeWidth={1} />
        </g>
      );
      break;

    // ─── Eléctrico
    case "toma":
      body = (
        <g>
          <Box w={w} h={h} fill="#fff" />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill={c} opacity={0.35} />
          {[-w * 0.2, w * 0.2].map((x) => (
            <g key={x}>
              <rect x={x - 3} y={-3} width={1.6} height={5} fill="#111" />
              <rect x={x + 1.4} y={-3} width={1.6} height={5} fill="#111" />
            </g>
          ))}
        </g>
      );
      break;
    case "regleta":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={3} />
          {Array.from({ length: item.source?.sockets ?? 6 }, (_, i) => (
            <circle key={i} cx={-w / 2 + ((i + 0.5) * w) / (item.source?.sockets ?? 6)} cy={0} r={Math.min(h * 0.3, 3)} fill="#1f2937" />
          ))}
        </g>
      );
      break;
    case "extension": {
      const r = Math.min(w, h) / 2;
      body = (
        <g>
          <circle r={r} fill={c} stroke={STROKE} strokeWidth={SW} />
          <circle r={r * 0.75} fill="none" stroke="#7c2d12" strokeWidth={1} strokeDasharray="2 2" />
          <circle r={r * 0.35} fill="#1f2937" />
        </g>
      );
      break;
    }
    case "distribuidor":
    case "generador":
    case "dimmer":
    case "ups":
      body = (
        <g>
          <Box w={w} h={h} fill={c} rx={3} />
          <text y={4} textAnchor="middle" fontSize={Math.min(12, h * 0.4)} fontWeight={700} fill="#fff">
            {{ distribuidor: "DISTRO", generador: "GEN", dimmer: "DMX", ups: "UPS" }[item.type]}
          </text>
        </g>
      );
      break;

    // ─── Anotaciones
    case "texto":
      body = (
        <text textAnchor="middle" dominantBaseline="middle" fontSize={(item.fontSize ?? 0.25) * PX} fill={c} fontWeight={600}>
          {item.label}
        </text>
      );
      break;
    case "zona":
      body = <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={c} fillOpacity={0.12} stroke={c} strokeWidth={1.5} strokeDasharray="8 5" rx={4} />;
      break;
    case "flecha": {
      const head = Math.min(w, h * 0.3);
      body = (
        <g>
          <line x1={0} y1={h / 2} x2={0} y2={-h / 2 + head} stroke={c} strokeWidth={Math.max(2, w * 0.2)} />
          <polygon points={`0,${-h / 2} ${-w / 2},${-h / 2 + head} ${w / 2},${-h / 2 + head}`} fill={c} />
        </g>
      );
      break;
    }
    case "marca":
      body = (
        <g stroke={c} strokeWidth={4} strokeLinecap="round">
          <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={-h / 2} />
          <line x1={0} y1={-h / 2} x2={0} y2={h / 2} />
        </g>
      );
      break;

    default:
      body = <Box w={w} h={h} fill={c} />;
  }

  return body;
}

/** Shared gradients/patterns referenced by symbols. */
export function SymbolDefs() {
  return (
    <>
      <radialGradient id="pl-head" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#9ca3af" />
        <stop offset="100%" stopColor="#374151" />
      </radialGradient>
      <linearGradient id="pl-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f3f4f6" />
        <stop offset="100%" stopColor="#9ca3af" />
      </linearGradient>
      <linearGradient id="pl-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#6b7280" />
        <stop offset="45%" stopColor="#e5e7eb" />
        <stop offset="100%" stopColor="#6b7280" />
      </linearGradient>
      <radialGradient id="pl-soft" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#c7cad1" />
      </radialGradient>
      <linearGradient id="pl-shine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
        <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.15} />
      </linearGradient>
      <pattern id="pl-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#00000022" strokeWidth="2" />
      </pattern>
    </>
  );
}
