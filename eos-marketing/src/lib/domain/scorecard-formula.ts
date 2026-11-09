/**
 * Fórmulas de indicadores calculados: variables de una letra (A–Z) que apuntan a indicadores,
 * números, + − × ÷ y paréntesis. Ej.: "A + B - C", "(A + B) / C * 100", "A * 2".
 * Se evalúa sin `eval`: tokens → notación polaca inversa (shunting-yard) → pila.
 */

export type MetricFormula = { expr: string; vars: Record<string, number> };

type Token = { t: "num"; v: number } | { t: "var"; v: string } | { t: "op"; v: "+" | "-" | "*" | "/" | "neg" } | { t: "("; } | { t: ")" };

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, neg: 3 };

function tokenize(expr: string): Token[] {
  const out: Token[] = [];
  const s = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.,]/.test(c)) {
      const m = s.slice(i).match(/^\d+(?:[.,]\d+)?|^[.,]\d+/);
      if (!m) throw new Error(`Número inválido cerca de “${s.slice(i, i + 5)}”`);
      out.push({ t: "num", v: Number(m[0].replace(",", ".")) });
      i += m[0].length;
    } else if (/[A-Za-z]/.test(c)) {
      if (/[A-Za-z]/.test(s[i + 1] ?? "")) throw new Error("Las variables son una sola letra (A, B, C…).");
      out.push({ t: "var", v: c.toUpperCase() });
      i++;
    } else if ("+-*/".includes(c)) {
      const prev = out[out.length - 1];
      const unary = c === "-" && (!prev || prev.t === "op" || prev.t === "(");
      if (unary) out.push({ t: "op", v: "neg" });
      else out.push({ t: "op", v: c as "+" | "-" | "*" | "/" });
      i++;
    } else if (c === "(") {
      out.push({ t: "(" });
      i++;
    } else if (c === ")") {
      out.push({ t: ")" });
      i++;
    } else {
      throw new Error(`Carácter no permitido: “${c}”`);
    }
  }
  return out;
}

function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const ops: Token[] = [];
  let expectValue = true;
  for (const tk of tokens) {
    if (tk.t === "num" || tk.t === "var") {
      if (!expectValue) throw new Error("Falta un operador entre dos valores.");
      out.push(tk);
      expectValue = false;
    } else if (tk.t === "op") {
      if (tk.v === "neg") {
        if (!expectValue) throw new Error("Operador en un lugar inválido.");
        ops.push(tk);
        continue;
      }
      if (expectValue) throw new Error("Falta un valor antes de un operador.");
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t !== "op" || PREC[top.v] < PREC[tk.v]) break;
        out.push(ops.pop()!);
      }
      ops.push(tk);
      expectValue = true;
    } else if (tk.t === "(") {
      if (!expectValue) throw new Error("Falta un operador antes del paréntesis.");
      ops.push(tk);
    } else {
      if (expectValue) throw new Error("Paréntesis vacío o incompleto.");
      while (ops.length && ops[ops.length - 1].t !== "(") out.push(ops.pop()!);
      if (!ops.length) throw new Error("Sobra un paréntesis de cierre.");
      ops.pop();
    }
  }
  if (expectValue) throw new Error("La fórmula está incompleta.");
  while (ops.length) {
    const top = ops.pop()!;
    if (top.t === "(") throw new Error("Falta cerrar un paréntesis.");
    out.push(top);
  }
  return out;
}

/** Valida la fórmula: sintaxis y que cada variable usada tenga indicador. Devuelve el mensaje de error o null. */
export function formulaError(f: MetricFormula): string | null {
  if (!f.expr.trim()) return "Escribe la fórmula.";
  try {
    const tokens = tokenize(f.expr);
    toRpn(tokens);
    const used = [...new Set(tokens.filter((t) => t.t === "var").map((t) => (t as { v: string }).v))];
    if (used.length === 0) return "Usa al menos una variable (A, B…).";
    const missing = used.filter((v) => !f.vars[v]);
    if (missing.length) return `Falta elegir el indicador de ${missing.join(", ")}.`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Fórmula inválida.";
  }
}

/** Variables que realmente se usan en la expresión. */
export function usedVars(f: MetricFormula): string[] {
  try {
    return [...new Set(tokenize(f.expr).filter((t) => t.t === "var").map((t) => (t as { v: string }).v))];
  } catch {
    return [];
  }
}

/** Evalúa con los valores de cada variable; null si falta un valor o se divide entre cero. */
export function evaluateFormula(f: MetricFormula, value: (metricId: number) => number | null): number | null {
  let rpn: Token[];
  try {
    rpn = toRpn(tokenize(f.expr));
  } catch {
    return null;
  }
  const stack: number[] = [];
  for (const tk of rpn) {
    if (tk.t === "num") stack.push(tk.v);
    else if (tk.t === "var") {
      const id = f.vars[tk.v];
      const v = id ? value(id) : null;
      if (v === null || v === undefined || !Number.isFinite(v)) return null;
      stack.push(v);
    } else if (tk.t === "op") {
      if (tk.v === "neg") {
        stack.push(-stack.pop()!);
        continue;
      }
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (tk.v === "/" && b === 0) return null;
      stack.push(tk.v === "+" ? a + b : tk.v === "-" ? a - b : tk.v === "*" ? a * b : a / b);
    }
  }
  const r = stack[0];
  return Number.isFinite(r) ? r : null;
}

/** El valor guardado en la base puede venir como texto (JSON) u objeto. */
export function parseFormula(raw: unknown): MetricFormula | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as { expr?: unknown; vars?: unknown };
  if (typeof o.expr !== "string" || !o.vars || typeof o.vars !== "object") return null;
  const vars: Record<string, number> = {};
  for (const [k, id] of Object.entries(o.vars as Record<string, unknown>)) {
    if (/^[A-Z]$/.test(k) && Number(id) > 0) vars[k] = Number(id);
  }
  return { expr: o.expr, vars };
}

/** "Hygiene + Hub − Cadencia" con los nombres de los indicadores. */
export function describeFormula(f: MetricFormula, nameOf: (id: number) => string): string {
  return f.expr.replace(/[A-Za-z]/g, (c) => {
    const id = f.vars[c.toUpperCase()];
    return id ? `[${nameOf(id)}]` : c;
  });
}
