// Verifica cuántas veces consulta la campanita /admin/api/avisos (reloj simulado).
// Requiere la app en E2E_URL con el admin de tests/e2e.mjs ya creado.
import { chromium } from "playwright";

const B = process.env.E2E_URL ?? "http://localhost:3100";
const MIN = 60_000;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.clock.install();
let consultas = 0;
page.on("request", (r) => r.url().endsWith("/admin/api/avisos") && consultas++);
const ok = (c, m) => {
  if (!c) throw new Error("FALLO: " + m);
  console.log("✔", m);
};
const pasar = async (ms) => {
  await page.clock.runFor(ms);
  await page.waitForTimeout(300); // deja terminar los fetch reales
};
const actividad = () => page.mouse.move(100 + Math.random() * 300, 200);
const visibilidad = (estado) =>
  page.evaluate((e) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => e });
    document.dispatchEvent(new Event("visibilitychange"));
  }, estado);

await page.goto(B + "/admin/login");
await page.getByLabel("Correo").fill("ana@uni.edu");
await page.getByLabel("Contraseña").fill("secreto123");
await page.getByRole("button", { name: /Entrar/ }).click();
await page.waitForURL(B + "/admin");
await page.getByRole("button", { name: /Avisos/ }).waitFor();
ok(consultas === 0, "al cargar no consulta (los avisos vienen del servidor)");

for (let i = 0; i < 10; i++) {
  await actividad();
  await pasar(MIN);
}
ok(consultas === 2, `10 min en uso → 2 consultas (antes: 10). Hubo ${consultas}`);

consultas = 0;
await visibilidad("hidden");
await pasar(60 * MIN);
ok(consultas === 0, `1 hora en segundo plano → 0 consultas (antes: hasta 60). Hubo ${consultas}`);
await visibilidad("visible");
await pasar(1000);
ok(consultas === 1, "al volver a la pestaña consulta una vez");

consultas = 0;
await pasar(60 * MIN);
ok(consultas <= 3, `1 hora visible sin tocar nada → ${consultas} consultas (antes: 60)`);
const antes = consultas;
await actividad();
await pasar(1000);
ok(consultas === antes + 1, "al volver a usar el panel consulta de inmediato");

consultas = 0;
await page.getByRole("button", { name: /Avisos/ }).click();
await page.waitForTimeout(500);
ok(consultas === 1, "abrir la campanita siempre consulta");

await browser.close();
console.log("TODO OK");
