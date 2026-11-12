// Prueba de punta a punta de Revisión de Artes (admin + portal) con Playwright.
//
// Requisitos: base local vacía y migrada (npm run db:migrate), el simulador
// (node tests/simulador.mjs <correos.jsonl>) y la app con:
//   RESEND_API_KEY=re_test RESEND_API_URL=http://localhost:3999 \
//   DRIVE_CARPETA_URL=http://localhost:3999/embeddedfolderview npx next start -p 3100
// Uso: node tests/e2e.mjs <correos.jsonl> [carpeta-capturas]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const B = process.env.E2E_URL ?? "http://localhost:3100";
const CORREOS = process.argv[2];
const CAPTURAS = process.argv[3] ?? null;
const browser = await chromium.launch();
let total = 0;
const ok = (c, m) => {
  if (!c) throw new Error("FALLO: " + m);
  total++;
  console.log("✔", m);
};
const correos = () =>
  readFileSync(CORREOS, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const captura = (page, nombre, opts = {}) => CAPTURAS && page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, ...opts });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Imágenes de Drive simuladas (en las pruebas no hay archivos reales).
const svg = (color, texto) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="${color}"/><rect x="90" y="90" width="300" height="120" rx="16" fill="#fff"/><text x="120" y="170" font-size="56" font-family="sans-serif" fill="${color}">LOGO</text><text x="90" y="700" font-size="110" font-weight="bold" font-family="sans-serif" fill="#fff">${texto}</text></svg>`;
async function nuevoContexto() {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await ctx.route("https://drive.google.com/thumbnail**", (r) =>
    r.fulfill({ contentType: "image/svg+xml", body: svg(r.request().url().includes("V2") ? "#1f6f4a" : "#7a1f3d", "Admisiones") })
  );
  await ctx.route("https://drive.google.com/file/**", (r) => r.fulfill({ contentType: "text/html", body: "<p>Visor</p>" }));
  return ctx;
}
const drive = (id) => `https://drive.google.com/file/d/${id}/view`;

// ---------------- Admin: cuenta, correo de prueba y diseñadores ----------------
const actx = await nuevoContexto();
const admin = await actx.newPage();
await admin.goto(B + "/admin");
await admin.getByLabel("Nombre").fill("Ana Marketing");
await admin.getByLabel("Correo").fill("ana@uni.edu");
await admin.getByLabel(/Contraseña/).fill("secreto123");
await admin.getByRole("button", { name: "Crear cuenta" }).click();
await admin.waitForURL(B + "/admin");
ok((await admin.textContent("header")).includes("GES: Administrador de Revisión de Artes"), "header del admin");
ok((await admin.getByRole("button", { name: "Volver" }).count()) === 0, "sin botón Volver en el inicio");

await admin.getByRole("link", { name: "Administradores" }).click();
await admin.getByRole("button", { name: "Enviarme un correo de prueba" }).click();
await admin.getByText("Correo de prueba enviado a ana@uni.edu").waitFor();
ok(true, "correo de prueba (Resend)");

await admin.getByRole("link", { name: "Diseñadores" }).click();
await admin.waitForURL(/\/admin\/disenadores$/);
ok((await admin.getByRole("link", { name: "Diseñadores" }).getAttribute("aria-current")) === "page", "menú: sección activa como pastilla");
for (const [n, e] of [["Sofía López", "sofia@diseno.edu"], ["Pedro Ruiz", "pedro@diseno.edu"]]) {
  await admin.getByLabel("Nombre").fill(n);
  await admin.getByLabel("Correo").fill(e);
  await admin.getByRole("button", { name: "Agregar diseñador" }).click();
  await admin.getByText(`${n} agregado a Diseñadores`).waitFor();
}
ok((await admin.textContent("main")).includes("pedro@diseno.edu"), "diseñadores: lista con nombre y correo");
await admin.getByRole("button", { name: "Volver" }).click();
await admin.waitForURL(/\/admin\/administradores$/);
ok(true, "botón Volver regresa a la vista anterior");

// ---------------- Facultades, carreras y campañas con carrera ----------------
async function crearFacultad(nombre) {
  await admin.goto(B + "/admin");
  await admin.getByLabel("Nombre de la facultad").fill(nombre);
  await admin.getByRole("button", { name: "Agregar facultad" }).click();
  await admin.waitForURL(/facultades\/\d+$/);
  return { id: admin.url().split("/").pop(), codigo: (await admin.textContent("code")).trim() };
}
const ing = await crearFacultad("Facultad de Ingeniería");
const med = await crearFacultad("Facultad de Medicina");
await admin.goto(`${B}/admin/facultades/${ing.id}`);
for (const c of ["Ingeniería en Sistemas", "Ingeniería Civil"]) {
  await admin.getByPlaceholder("Nueva carrera").fill(c);
  await admin.getByRole("button", { name: "Agregar", exact: true }).click();
  await admin.waitForSelector(`input[value='${c}']`);
}

async function crearCampana(facId, nombre, carrera) {
  await admin.goto(`${B}/admin/facultades/${facId}`);
  await admin.getByLabel("Nombre de la campaña").fill(nombre);
  if (carrera) {
    await admin.getByRole("button", { name: /Carrera/ }).click();
    await admin.getByRole("option", { name: carrera }).click();
  }
  await admin.getByRole("button", { name: "Crear campaña" }).click();
  await admin.waitForURL(/campanas\/\d+$/);
  return admin.url().split("/").pop();
}
const campA = await crearCampana(ing.id, "Admisiones Sistemas", "Ingeniería en Sistemas");
ok((await admin.textContent("main")).includes("Ingeniería en Sistemas"), "la campaña muestra su carrera");
const campB = await crearCampana(ing.id, "Becas Civil", "Ingeniería Civil");
const campC = await crearCampana(ing.id, "Mini", null);
const campMed = await crearCampana(med.id, "Salud 2027", null);

async function crearArte(facId, campId, titulo, url) {
  await admin.goto(`${B}/admin/facultades/${facId}/nuevo-arte?campana=${campId}`);
  await admin.getByLabel("Título del arte").fill(titulo);
  await admin.getByLabel("Formato / canal").fill("Post Instagram");
  await admin.getByLabel("Fecha de publicación").fill("2026-12-15");
  await admin.getByLabel("Enlace de Google Drive").fill(url);
  await admin.getByRole("button", { name: "Crear arte" }).click();
  await admin.waitForURL(/admin\/artes\/\d+$/);
  return admin.url().split("/").pop();
}
ok((await (async () => {
  await admin.goto(`${B}/admin/facultades/${ing.id}/nuevo-arte?campana=${campA}`);
  return admin.getByRole("button", { name: /^Carrera/ }).count();
})()) === 0, "el arte ya no pide carrera (la toma de la campaña)");
const arteA = await crearArte(ing.id, campA, "Post lanzamiento", drive("1AbCdEfGhIjKlMnOpQrStUvWx1"));
const arteB = await crearArte(ing.id, campB, "Post Civil", drive("1CivilCivilCivilCivilCivil1"));
const arteC = await crearArte(ing.id, campC, "Post mini", drive("1MiniMiniMiniMiniMiniMini01"));
const arteMed = await crearArte(med.id, campMed, "Post Medicina", drive("1MedicinaMedicinaMedicina01"));

// ---------------- Subida en lote: coma + Enter y carpeta de Drive ----------------
await admin.goto(`${B}/admin/facultades/${ing.id}/campanas/${campA}/lote`);
ok((await admin.textContent("main")).includes("Carrera de la campaña: Ingeniería en Sistemas"), "lote: la carrera viene de la campaña");
await admin.getByLabel("Enlaces de Drive, uno por línea").fill(
  [
    `Post becas, ${drive("1LoteAAAAAAAAAAAAAAAAAAAAA1")}`,
    drive("1LoteBBBBBBBBBBBBBBBBBBBBB2"),
    `Historias, https://drive.google.com/drive/folders/1CarpetaPruebaCarpetaPrueba00`,
    `Malo, https://ejemplo.com/no-es-drive`,
    `Repetido, ${drive("1LoteAAAAAAAAAAAAAAAAAAAAA1")}`,
  ].join("\n")
);
await admin.getByRole("button", { name: "Agregar a la tabla" }).click();
await admin.getByTestId("aviso-carpetas").waitFor();
ok((await admin.getByTestId("fila-lote").count()) === 6, "lote: 4 enlaces + carpeta con 2 archivos = 6 filas");
ok((await admin.getByTestId("aviso-carpetas").textContent()).includes("2 archivos"), "lote: lee la carpeta e ignora subcarpetas");
ok(
  (await admin.getByLabel("Título del arte 1").inputValue()) === "Post becas" &&
    (await admin.getByLabel("Título del arte 2").inputValue()) === "Arte 2" &&
    (await admin.getByLabel("Título del arte 3").inputValue()) === "Historia IG 1" &&
    (await admin.getByLabel("Título del arte 4").inputValue()) === "Historia IG 2 & final",
  "lote: título con coma o del nombre del archivo de la carpeta"
);
ok(
  (await admin.getByText("Enlace de Drive inválido").count()) === 1 && (await admin.getByText("Enlace repetido en el lote").count()) === 2,
  "lote: marca enlaces inválidos y repetidos"
);
await admin.getByRole("button", { name: "Quitar arte 6" }).click();
await admin.getByRole("button", { name: "Quitar arte 5" }).click();
await admin.getByLabel("Formato / canal").fill("Historia IG");
await admin.getByRole("button", { name: "Aplicar a todas" }).click();
await admin.getByRole("button", { name: /Crear 4 artes/ }).click();
await admin.waitForURL(/campanas\/\d+\?lote=/);
await admin.getByText("Se crearon 4 artes").first().waitFor();
ok(true, "lote: crea los 4 artes en la campaña");

// ---------------- Portal: guía, filtro por carrera, acordeón ----------------
const pctx = await nuevoContexto();
const p = await pctx.newPage();
await p.goto(`${B}/portal/ingresar?codigo=${ing.codigo}`);
await p.getByLabel("Nombre completo").fill("Luis Decano");
await p.getByLabel("Correo electrónico").fill("luis@ing.uni.edu");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL(B + "/portal");
await p.getByRole("dialog", { name: /Hola, Luis/ }).waitFor();
await p.getByLabel("No mostrar guías automáticamente").check();
await p.getByRole("button", { name: "Omitir guía" }).click();
const home = await p.textContent("main");
ok(home.includes("Admisiones Sistemas") && home.includes("Becas Civil") && !home.includes("Salud 2027"), "portal: campañas de su facultad");
await p.getByRole("link", { name: /Ingeniería Civil\s*\(1\)/ }).click();
await p.waitForURL(/\?carrera=/);
const filtrado = await p.textContent("main");
ok(filtrado.includes("Becas Civil") && !filtrado.includes("Admisiones Sistemas"), "portal: filtro por carrera en la primera vista");
ok((await p.goto(`${B}/portal/campanas/${campMed}`)).status() === 404, "campaña de otra facultad: 404");
ok((await p.goto(`${B}/portal/artes/${arteMed}`)).status() === 404, "arte de otra facultad: 404");

// Aprobar el único arte de "Becas Civil" → campaña aprobada → confeti y acordeón.
await p.goto(`${B}/portal/campanas/${campB}`);
await p.getByText("Post Civil").click();
await p.waitForURL(/portal\/artes\//);
await p.getByRole("button", { name: "✓ Aprobar" }).click();
await p.getByTestId("confeti").waitFor({ timeout: 8000 });
ok(true, "portal: confeti al aprobar el último arte de la campaña");
await captura(p, "1-confeti-portal");
await p.getByRole("button", { name: "Volver" }).click();
await p.waitForURL(/portal\/campanas\//);
ok(true, "portal: Volver regresa a la campaña");
await p.goto(B + "/portal");
const grupo = p.getByTestId("grupo-aprobados");
ok((await grupo.textContent()).includes("Campañas aprobadas (1)") && !(await grupo.evaluate((d) => d.open)), "portal: campañas aprobadas agrupadas y cerradas abajo");
const activas = await p.locator("main > div > div.grid").first().textContent();
ok(!activas.includes("Becas Civil"), "portal: la campaña aprobada sale de la vista principal");
await grupo.locator("summary").click();
ok(await grupo.evaluate((d) => d.open), "portal: el acordeón se abre");
await captura(p, "2-acordeon-portal", { fullPage: true });

// ---------------- Puntos: guardado verificado al pulsar "Listo" ----------------
await p.goto(`${B}/portal/artes/${arteA}`);
const lienzo = p.getByTestId("lienzo-arte");
await lienzo.waitFor();
await p.waitForFunction(() => document.querySelector("[data-testid=lienzo-arte] img")?.complete);
let box = await lienzo.boundingBox();
await p.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.11);
await p.getByRole("button", { name: "Listo" }).click();
await p.getByText("Escribe qué hay que cambiar aquí.").waitFor();
ok(true, "puntos: no guarda un punto sin descripción");
await p.getByLabel("Cambio del punto 1").fill("El logo debe ir en blanco");
await p.getByRole("button", { name: "Listo" }).click();
await p.getByRole("status").filter({ hasText: "Punto 1 guardado" }).waitFor();
ok((await p.getByTestId("estado-punto-1").textContent()).includes("Guardado"), "puntos: aviso “Punto 1 guardado” y estado Guardado");
await captura(p, "3-punto-guardado");
box = await lienzo.boundingBox();
await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
await p.getByLabel("Cambio del punto 2").fill("Cambiar la fecha");
await p.getByRole("button", { name: "Listo" }).click();
await p.getByRole("status").filter({ hasText: "Punto 2 guardado" }).waitFor();
await p.reload();
await p.getByTestId("estado-punto-2").waitFor();
ok(
  (await p.textContent("main")).includes("El logo debe ir en blanco") && (await p.getByTestId("estado-punto-1").textContent()).includes("Guardado"),
  "puntos: siguen guardados al recargar la página (verificado en el servidor)"
);
await p.getByLabel("Comentario general").fill("Revisar el tamaño del texto");
await p.getByRole("button", { name: "Solicitar cambios" }).click();
await p.getByText("Enviamos tu solicitud").waitFor();
await p.reload();
await p.getByTestId("lienzo-arte").waitFor();
ok((await p.getByTestId("estado-punto-1").count()) === 0 && (await p.getByRole("button", { name: /^Punto \d$/ }).count()) === 2, "puntos: al enviar pasan a la revisión y se limpian los borradores");

// ---------------- Admin: reporte, diseñadores, checklist y campanita ----------------
await admin.goto(`${B}/admin/facultades/${ing.id}/campanas/${campA}/reporte`);
await admin.getByRole("button", { name: "Crear enlace para Diseño" }).click();
const enlaceRep = (await admin.locator("code").first().textContent()).trim();
await admin.getByRole("checkbox", { name: /Sofía López/ }).click({ force: true });
await admin.getByLabel("Otros correos (opcional)").fill("extra@diseno.edu");
await admin.getByRole("button", { name: "Enviar reporte a Diseño" }).click();
await admin.getByText(/Correo enviado a/).first().waitFor();
const rep = correos().find((m) => m.body.subject?.startsWith("Cambios para diseño: Admisiones Sistemas"));
ok(rep && rep.body.to.includes("sofia@diseno.edu") && rep.body.to.includes("extra@diseno.edu") && !rep.body.to.includes("pedro@diseno.edu"), "reporte: se envía a los diseñadores elegidos + otros correos");

const dctx = await nuevoContexto();
const dp = await dctx.newPage();
await dp.goto(enlaceRep.replace(/^https?:\/\/[^/]+/, B));
for (let i = 0; i < 3; i++) await dp.getByRole("checkbox").nth(i).click();
await dp.getByText("✓ Todos listos").waitFor();
await admin.goto(B + "/admin");
await admin.getByRole("button", { name: /Avisos/ }).click();
await admin.getByRole("button", { name: /Diseño terminó los cambios de “Post lanzamiento”/ }).waitFor();
ok(true, "checklist de Diseño completo → aviso en la campanita");
await dctx.close();

// ---------------- Admin: nueva versión sin archivo y aprobación manual + confeti ----------------
await admin.goto(`${B}/admin/artes/${arteA}`);
await admin.getByRole("checkbox", { name: /Confirmar cambios sin archivo nuevo/ }).click({ force: true });
await admin.getByLabel("¿Qué se cambió?").fill("Logo en blanco y fecha corregida");
await admin.getByRole("button", { name: /Confirmar cambios \(v2\)/ }).click();
await admin.getByText("v2 publicada").first().waitFor();
ok(true, "nueva versión confirmada sin archivo nuevo");

await admin.goto(`${B}/admin/artes/${arteC}`);
await admin.getByLabel("Nota de la aprobación").fill("Aprobado por correo");
await admin.getByRole("button", { name: "Aprobar manualmente" }).click();
await admin.getByTestId("confeti").waitFor({ timeout: 8000 });
ok(true, "admin: aprobación manual y confeti al completar la campaña");
await captura(admin, "4-confeti-admin");
await admin.getByText("Aprobación manual").waitFor({ state: "detached" });
await admin.reload();
ok((await admin.textContent("main")).includes("Aprobado por correo") && (await admin.getByText("Aprobación manual").count()) === 0, "aprobación manual: queda en el historial");
await admin.goto(`${B}/admin/facultades/${ing.id}`);
ok((await admin.getByTestId("grupo-aprobados").textContent()).includes("Campañas aprobadas (2)"), "admin: campañas aprobadas agrupadas abajo");
await captura(admin, "5-facultad-admin", { fullPage: true });

await browser.close();
console.log(`TODO OK (${total} verificaciones)`);
