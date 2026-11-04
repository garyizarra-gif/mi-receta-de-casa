// Servidor local de la app (solo para desarrollo/pruebas). Uso: node scripts/servir.mjs [puerto] [--red]
//  - sin --red: solo esta computadora (http://127.0.0.1:PUERTO)
//  - con --red: también otros dispositivos de la misma red Wi-Fi (ej. tu celular); muestra la dirección a abrir.
// Reemplaza a `python -m http.server`, que rechaza conexiones cuando el navegador pide muchos archivos a la vez.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const RAIZ = join(fileURLToPath(new URL("..", import.meta.url)), "app");
const args = process.argv.slice(2);
const PUERTO = Number(args.find((a) => /^\d+$/.test(a))) || 8765;
const RED = args.includes("--red");
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    let ruta = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    if (ruta === "" || ruta.endsWith(sep)) ruta = join(ruta, "index.html");
    const archivo = join(RAIZ, ruta);
    if (!archivo.startsWith(RAIZ + sep)) { res.writeHead(403).end("Prohibido"); return; }   // sin salir de app/
    const st = await stat(archivo);
    if (!st.isFile()) throw new Error("no es archivo");
    res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(archivo));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No encontrado");
  }
});
servidor.listen(PUERTO, RED ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Menú de casa → http://127.0.0.1:${PUERTO}`);
  if (RED) for (const lista of Object.values(networkInterfaces())) for (const i of lista || []) if (i.family === "IPv4" && !i.internal) console.log(`En tu celular (misma Wi-Fi) → http://${i.address}:${PUERTO}`);
});
