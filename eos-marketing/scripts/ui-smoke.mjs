/**
 * Prueba de humo de la interfaz y medición de velocidad (Playwright).
 *
 * Recorre todas las secciones del menú en modo claro y oscuro, revisa que
 * carguen sin errores y mide tiempos de carga; además prueba el menú
 * colapsable, el cambio de tema y el menú en celular.
 *
 * Uso (con la app corriendo, de preferencia `npm run build && npm start`):
 *   EOS_URL=http://localhost:3000 EOS_EMAIL=... EOS_PASSWORD=... node scripts/ui-smoke.mjs
 *
 * Requiere Playwright con Chromium (`npx playwright install chromium` si no está).
 * Sale con código 1 si alguna página falla o supera los umbrales de velocidad.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const BASE = process.env.EOS_URL ?? "http://localhost:3000";
const EMAIL = process.env.EOS_EMAIL;
const PASSWORD = process.env.EOS_PASSWORD;
const STATE = process.env.EOS_STATE; // archivo de sesión de Playwright (opcional, en lugar de usuario/contraseña)

// Umbrales: lo que se considera "rápido" en una red local o en Netlify.
const LIMITS = { ttfb: 800, fcp: 1800, lcp: 2500, cls: 0.1 };

const failures = [];
const rows = [];

function fail(msg) {
  failures.push(msg);
  console.log("  ✗ " + msg);
}

async function newContext(browser, { mode = "light", mobile = false, collapsed = false } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    colorScheme: mode,
    ...(STATE ? { storageState: STATE } : {}),
  });
  const cookies = [{ name: "eos-theme", value: mode, url: BASE }];
  if (collapsed) cookies.push({ name: "eos-sidebar", value: "collapsed", url: BASE });
  await ctx.addCookies(cookies);
  return ctx;
}

async function login(page) {
  if (STATE) return;
  if (!EMAIL || !PASSWORD) throw new Error("Define EOS_EMAIL y EOS_PASSWORD (o EOS_STATE).");
  await page.goto(BASE + "/login");
  await page.fill('[name="email"]', EMAIL);
  await page.fill('[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Métricas de carga de la página actual (navegación completa). */
async function vitals(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
          resolve({ ttfb: nav.responseStart, fcp, lcp, cls, load: nav.loadEventEnd });
        }, 600);
      })
  );
}

async function checkRoutes(browser, mode) {
  console.log(`\n▶ Secciones en modo ${mode === "dark" ? "oscuro" : "claro"}`);
  const ctx = await newContext(browser, { mode });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await login(page);
  await page.goto(BASE + "/");
  const hrefs = await page.$$eval('aside nav a[href^="/"], aside a[href="/ajustes"]', (as) => [
    ...new Set(as.map((a) => a.getAttribute("href"))),
  ]);
  for (const href of hrefs) {
    errors.length = 0;
    const res = await page.goto(BASE + href, { waitUntil: "load", timeout: 60_000 });
    const v = await vitals(page);
    const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    const hasContent = (await page.locator("main").innerText()).trim().length > 0;
    rows.push({ mode, href, status: res?.status(), ...v });
    if (!res || res.status() >= 400) fail(`${href}: respuesta ${res?.status()}`);
    if (dark !== (mode === "dark")) fail(`${href}: el modo ${mode} no se aplicó`);
    if (!hasContent) fail(`${href}: la página quedó vacía`);
    if (errors.length) fail(`${href}: errores en el navegador: ${errors.slice(0, 2).join(" | ")}`);
    if (v.ttfb > LIMITS.ttfb) fail(`${href}: TTFB ${Math.round(v.ttfb)} ms > ${LIMITS.ttfb}`);
    if (v.lcp > LIMITS.lcp) fail(`${href}: LCP ${Math.round(v.lcp)} ms > ${LIMITS.lcp}`);
    if (v.cls > LIMITS.cls) fail(`${href}: CLS ${v.cls.toFixed(3)} > ${LIMITS.cls}`);
  }
  await ctx.close();
}

async function checkInteractions(browser) {
  console.log("\n▶ Interacciones");
  // Menú colapsable en escritorio.
  let ctx = await newContext(browser);
  let page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + "/");
  const aside = page.locator("aside").first();
  const wide = (await aside.boundingBox()).width;
  await page.getByRole("button", { name: /Ocultar menú/ }).click();
  await page.waitForTimeout(400);
  const narrow = (await aside.boundingBox()).width;
  const main = await page.locator("main").boundingBox();
  if (!(narrow < 80 && wide > 200)) fail(`menú colapsado: ancho ${wide} → ${narrow}`);
  if (main.x < narrow) fail("menú colapsado: el contenido queda debajo del menú");
  await page.getByRole("button", { name: /Mostrar menú/ }).click();
  console.log(`  ✓ menú: ${Math.round(wide)}px ↔ ${Math.round(narrow)}px`);

  // Cambio de tema desde la barra superior.
  await page.getByRole("button", { name: /Cambiar a modo oscuro/ }).click();
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => document.documentElement.classList.contains("dark")))) fail("el botón de tema no activó el modo oscuro");
  await page.getByRole("button", { name: /Cambiar a modo claro/ }).click();
  console.log("  ✓ cambio de tema claro ↔ oscuro");
  await ctx.close();

  // Menú en celular: abre, navega y se cierra.
  ctx = await newContext(browser, { mobile: true });
  page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: /Mostrar menú|Ocultar menú/ }).first().click();
  const drawer = page.locator("aside").first();
  await page.waitForTimeout(300);
  if ((await drawer.boundingBox()).x < -10) fail("celular: el menú no se abrió");
  await drawer.getByRole("link", { name: "To-Dos" }).click();
  await page.waitForURL("**/todos");
  await page.waitForTimeout(300);
  if ((await drawer.boundingBox()).x > -10) fail("celular: el menú no se cerró al navegar");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`celular: la página se desborda ${overflow}px a lo ancho`);
  console.log("  ✓ menú en celular");
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await checkRoutes(browser, "light");
  await checkRoutes(browser, "dark");
  await checkInteractions(browser);
} finally {
  await browser.close();
}

console.log("\nSección                         modo   TTFB   FCP    LCP    CLS");
for (const r of rows) {
  console.log(
    `${r.href.padEnd(30)} ${r.mode.padEnd(5)} ${String(Math.round(r.ttfb)).padStart(5)} ${String(Math.round(r.fcp)).padStart(5)} ${String(Math.round(r.lcp)).padStart(6)}  ${r.cls.toFixed(3)}`
  );
}
const med = (k) => {
  const v = rows.map((r) => r[k]).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};
console.log(`\nMediana: TTFB ${Math.round(med("ttfb"))} ms · FCP ${Math.round(med("fcp"))} ms · LCP ${Math.round(med("lcp"))} ms`);
console.log(failures.length ? `\n${failures.length} problema(s).` : "\nTodo en orden.");
process.exit(failures.length ? 1 : 0);
