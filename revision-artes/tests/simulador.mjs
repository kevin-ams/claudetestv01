// Simulador para pruebas locales: imita la API de Resend (guarda cada correo en
// un archivo JSONL) y la vista de carpetas de Google Drive.
// Uso: node tests/simulador.mjs <archivo-correos.jsonl> [puerto=3999]
import http from "node:http";
import fs from "node:fs";

const salida = process.argv[2] ?? "correos.jsonl";
const puerto = Number(process.argv[3] ?? 3999);
fs.writeFileSync(salida, "");

// Carpeta de Drive simulada: 2 archivos y una subcarpeta (que se ignora).
const carpeta = (id) =>
  id === "1CarpetaPruebaCarpetaPrueba00"
    ? `<html><body><div class="flip-entries">
<div class="flip-entry" id="entry-1CarpArchivoUnoUnoUnoUno001"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/1CarpArchivoUnoUnoUnoUno001/view?usp=drive_web" target="_blank"><div class="flip-entry-title"> Historia_IG_1.png</div></a></div></div>
<div class="flip-entry" id="entry-1CarpArchivoDosDosDosDos002"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/1CarpArchivoDosDosDosDos002/view?usp=drive_web" target="_blank"><div class="flip-entry-title"> Historia IG 2 &amp; final.jpg</div></a></div></div>
<div class="flip-entry" id="entry-1SubcarpetaSubcarpeta0003"><div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/1SubcarpetaSubcarpeta0003" target="_blank"><div class="flip-entry-title"> Otra carpeta</div></a></div></div>
</div></body></html>`
    : null;

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/embeddedfolderview") {
      const html = carpeta(url.searchParams.get("id"));
      res.writeHead(html ? 200 : 404, { "Content-Type": "text/html" });
      return res.end(html ?? "no encontrado");
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      fs.appendFileSync(salida, JSON.stringify({ path: req.url, auth: req.headers.authorization, body: JSON.parse(body || "{}") }) + "\n");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "simulado-" + Date.now() }));
    });
  })
  .listen(puerto, () => console.log(`simulador en ${puerto}`));
