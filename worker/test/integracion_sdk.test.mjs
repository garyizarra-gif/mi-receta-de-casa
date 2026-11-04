// Integración con el SDK REAL de Anthropic contra un servidor local que imita POST /v1/messages.
// Comprueba la forma de la solicitud (cabeceras, modelo, imágenes, esquema JSON) y que la respuesta se interprete bien.
// NO llama a la API de verdad: eso solo se puede probar con una clave real (ver LEEME.md, paso "Probar").
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { manejar } from "../src/nucleo.js";

const IMG = { media_type: "image/jpeg", data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwME" };
const catalogo = [{ id: "pollo", nombre: "Pollo" }, { id: "papa", nombre: "Papa blanca" }, { id: "tomate", nombre: "Tomate" }];

async function conServidor(respuesta, fn) {
  const vistos = [];
  const srv = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { vistos.push({ url: req.url, metodo: req.method, cab: req.headers, cuerpo: JSON.parse(b || "{}") }); res.writeHead(respuesta.estado ?? 200, { "Content-Type": "application/json" }); res.end(JSON.stringify(respuesta.datos)); });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${srv.address().port}`, vistos); } finally { await new Promise((r) => srv.close(r)); }
}
const mensaje = (texto, extra = {}) => ({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: texto }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1800, output_tokens: 120 }, ...extra });
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, String(v)); } }; };
const entorno = () => ({ ANTHROPIC_API_KEY: "sk-ant-prueba-local", APP_TOKEN: "t", CONTADOR: kv(), ORIGENES: "https://familia.github.io" });
const pedir = () => new Request("https://w.dev/analizar", { method: "POST", headers: { "Content-Type": "application/json", "X-Menu-Token": "t", Origin: "https://familia.github.io" }, body: JSON.stringify({ imagenes: [IMG], catalogo }) });

test("con el SDK real: la solicitud tiene la forma correcta y la respuesta estructurada se interpreta", async () => {
  await conServidor({ datos: mensaje('{"ingredientes":["pollo","papa"],"otros":["rocoto"]}') }, async (base, vistos) => {
    const deps = { ahora: () => new Date("2026-11-03T15:00:00Z"), crearCliente: (e) => new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, baseURL: base, maxRetries: 0 }) };
    const r = await manejar(pedir(), entorno(), deps);
    const d = await r.json();
    assert.equal(r.status, 200, JSON.stringify(d));
    assert.deepEqual(d.ingredientes, ["pollo", "papa"]); assert.deepEqual(d.otros, ["rocoto"]);
    assert.equal(d.uso.costo_usd, 0.0096);                         // (1800*4 + 120*20) / 1e6

    assert.equal(vistos.length, 1);
    const v = vistos[0];
    assert.equal(v.metodo, "POST"); assert.equal(v.url, "/v1/messages");
    assert.equal(v.cab["authorization"], "Bearer sk-ant-prueba-local");   // el SDK 1.x manda la clave así; viaja SOLO en esta cabecera, hacia Anthropic
    assert.ok(v.cab["anthropic-version"]);
    const c = v.cuerpo;
    assert.equal(c.model, "claude-opus-5-5");
    assert.equal(c.messages[0].role, "user");
    assert.equal(c.messages[0].content[0].type, "image");
    assert.deepEqual(c.messages[0].content[0].source, { type: "base64", media_type: "image/jpeg", data: IMG.data });
    assert.match(c.system, /CATÁLOGO/);
    // salida estructurada: esquema JSON simple con `ingredientes` y `otros` (los ids se validan en el servidor contra el catálogo)
    const fmt = c.output_config.format;
    assert.equal(fmt.type, "json_schema");
    assert.equal(fmt.schema.type, "object");
    assert.deepEqual(Object.keys(fmt.schema.properties).sort(), ["ingredientes", "otros"]);
    assert.deepEqual(fmt.schema.required.sort(), ["ingredientes", "otros"]);
    assert.equal(fmt.schema.additionalProperties, false);
    assert.equal(c.output_config.effort, "low");
    assert.ok(c.thinking === undefined || c.thinking.type !== "enabled");   // nunca el modo con presupuesto (da 400 en estos modelos)
    assert.ok(c.tool_choice === undefined);                                  // sin tool_choice forzado (da 400 en Opus 5.5)
    assert.ok(!("temperature" in c) && !("top_p" in c));                     // sin parámetros de muestreo (dan 400)
    assert.ok(!JSON.stringify(c).includes("sk-ant"));                        // la clave no está en el cuerpo
  });
});

test("con el SDK real: un error 401 de Anthropic se traduce a 'clave_api' sin filtrar nada", async () => {
  await conServidor({ estado: 401, datos: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } }, async (base) => {
    const deps = { ahora: () => new Date("2026-11-03T15:00:00Z"), crearCliente: (e) => new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, baseURL: base, maxRetries: 0 }) };
    const r = await manejar(pedir(), entorno(), deps);
    const texto = await r.text();
    assert.equal(r.status, 502); assert.equal(JSON.parse(texto).error, "clave_api");
    assert.ok(!texto.includes("sk-ant"));
  });
});

test("con el SDK real: un id inventado por el modelo se descarta, no hace fallar el análisis", async () => {
  await conServidor({ datos: mensaje('{"ingredientes":["ovni","pollo"],"otros":["rocoto"]}') }, async (base) => {
    const deps = { ahora: () => new Date("2026-11-03T15:00:00Z"), crearCliente: (e) => new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, baseURL: base, maxRetries: 0 }) };
    const r = await manejar(pedir(), entorno(), deps);
    const d = await r.json();
    assert.equal(r.status, 200); assert.deepEqual(d.ingredientes, ["pollo"]); assert.deepEqual(d.otros, ["rocoto"]);   // "ovni" no está en el catálogo
  });
});

test("con el SDK real: una respuesta que no es JSON del esquema se informa como error, sin romper", async () => {
  await conServidor({ datos: mensaje("lo siento, no puedo") }, async (base) => {
    const deps = { ahora: () => new Date("2026-11-03T15:00:00Z"), crearCliente: (e) => new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, baseURL: base, maxRetries: 0 }) };
    const env = entorno();
    const r = await manejar(pedir(), env, deps);
    const d = await r.json();
    assert.notEqual(r.status, 200); assert.equal(d.ok, false);
    assert.equal(env.CONTADOR.m.get("gasto:2026-11"), "0.02");     // se cobró aunque no se pudo leer: cargo de precaución
  });
});
