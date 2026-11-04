import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pareceClaveApi, ingredientesNecesarios, coincidencias, separar, catalogoParaFoto, normalizarUrl, interpretarRespuesta, mensajeError, CATEGORIAS_COCINAR } from "../app/src/cocinar.js";
import { CATEGORIAS } from "../app/src/formato.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const ingredientes = leer("app/data/ingredientes.json");
const ingPorId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));
const porId = new Map(platos.map((p) => [p.id, p]));

test("las categorías de '¿Qué cocino?' existen en la app", () => {
  const ids = new Set(CATEGORIAS.map((c) => c.id));
  for (const c of CATEGORIAS_COCINAR) assert.ok(ids.has(c.id));
});

test("ingredientes necesarios: sin básicos y sin los 'al gusto'", () => {
  const nec = ingredientesNecesarios(porId.get("A04"), ingPorId);
  assert.deepEqual(nec.sort(), ["aji_amarillo", "cebolla", "leche_evaporada", "pan_molde", "papa", "pollo", "queso_parmesano"]);
  assert.ok(!nec.includes("aceite") && !nec.includes("ajo") && !nec.includes("sal"));
  assert.deepEqual(ingredientesNecesarios({ ingredientes: [{ id: "aceite", cant: null }] }, ingPorId), []);
});

test("con todos los ingredientes, el plato sale como 'listo'", () => {
  const tengo = new Set(ingredientesNecesarios(porId.get("A04"), ingPorId));
  const r = coincidencias(platos, tengo, ingPorId, { categoria: "almuerzo" });
  const aji = r.find((x) => x.plato.id === "A04");
  assert.deepEqual(aji.faltan, []); assert.equal(aji.tiene, aji.total);
  assert.ok(separar(r).listos.some((x) => x.plato.id === "A04"));
  assert.equal(r[0].faltan.length, 0);                                    // los listos van primero
});

test("'te falta poco': faltan 1 o 2; con 3 o más no se muestra", () => {
  const nec = ingredientesNecesarios(porId.get("A04"), ingPorId);
  const sin1 = new Set(nec.filter((i) => i !== "queso_parmesano"));
  const r1 = coincidencias(platos, sin1, ingPorId, { categoria: "almuerzo" }).find((x) => x.plato.id === "A04");
  assert.deepEqual(r1.faltan, ["queso_parmesano"]);
  const sin3 = new Set(nec.filter((i) => !["queso_parmesano", "pan_molde", "leche_evaporada"].includes(i)));
  assert.equal(coincidencias(platos, sin3, ingPorId, { categoria: "almuerzo" }).some((x) => x.plato.id === "A04"), false);
  assert.equal(coincidencias(platos, sin3, ingPorId, { categoria: "almuerzo", maxFaltan: 3 }).some((x) => x.plato.id === "A04"), true);
});

test("orden: menos faltantes primero, luego más ingredientes que ya tiene, luego alfabético", () => {
  const tengo = new Set(["huevo", "zanahoria", "espinaca", "queso_fresco", "papa"]);
  const r = coincidencias(platos, tengo, ingPorId, { categoria: "desayuno" });
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].faltan.length <= r[i].faltan.length);
  assert.ok(r.length > 0);
});

test("solo cuenta la categoría pedida, y un plato sin ingredientes no se evalúa", () => {
  const todos = [...platos, { id: "U1", categoria: "almuerzo", nombre: "Mi plato", ingredientes: [], base: "por_persona" }];
  const tengo = new Set(Object.keys(ingPorId));
  const r = coincidencias(todos, tengo, ingPorId, { categoria: "lonchera" });
  assert.ok(r.every((x) => x.plato.categoria === "lonchera"));
  assert.ok(!coincidencias(todos, tengo, ingPorId, { categoria: "almuerzo" }).some((x) => x.plato.id === "U1"));
});

test("un ingrediente propio del usuario también cuenta", () => {
  const rocoto = { id: "x_rocoto", nombre: "Rocoto", grupo: "Verduras", compra: "kg", basico: false, propio: true };
  const ing = { ...ingPorId, x_rocoto: rocoto };
  const mio = { id: "U2", categoria: "almuerzo", nombre: "Rocoto relleno", base: "por_persona", ingredientes: [{ id: "x_rocoto", cant: 100, unidad: "g" }, { id: "carne_molida", cant: 80, unidad: "g" }] };
  const r = coincidencias([mio], new Set(["x_rocoto", "carne_molida"]), ing, { categoria: "almuerzo" });
  assert.deepEqual(r[0].faltan, []);
});

test("catálogo para la foto: sin básicos, con nombres limpios y dentro del límite", () => {
  const c = catalogoParaFoto(ingredientes);
  assert.ok(c.length > 80 && c.length <= 400);
  assert.ok(!c.some((i) => ["aceite", "sal", "ajo"].includes(i.id)));
  assert.equal(c.find((i) => i.id === "pollo").nombre, "Pollo");                           // sin el "(pechuga o pierna)"
  assert.ok(c.every((i) => /^[a-z0-9_]{1,40}$/.test(i.id) && i.nombre.length > 0 && i.nombre.length <= 60));
  assert.equal(new Set(c.map((i) => i.id)).size, c.length);
});

test("la dirección del servicio: https, o una red local para probar; nunca http por internet", () => {
  assert.deepEqual(normalizarUrl(" https://mi-app.workers.dev/ "), { ok: true, url: "https://mi-app.workers.dev" });
  assert.equal(normalizarUrl("http://127.0.0.1:8770").ok, true);
  assert.equal(normalizarUrl("http://192.168.1.20:8787").ok, true);
  assert.equal(normalizarUrl("http://mi-app.workers.dev").ok, false);
  assert.equal(normalizarUrl("mi-app.workers.dev").ok, false);
  assert.equal(normalizarUrl("").ok, false);
  assert.equal(normalizarUrl("https://mi-app.workers.dev/analizar").ok, false);
  assert.equal(normalizarUrl("ftp://x.com").ok, false);
});

test("interpretar respuesta: solo ids que existen en la app; 'otros' limpios y limitados", () => {
  const r = interpretarRespuesta({ ingredientes: ["pollo", "ovni", "pollo", 5, "papa"], otros: [" rocoto ", "rocoto", "", 7, ...Array.from({ length: 30 }, (_, i) => "x" + i)] }, ingPorId);
  assert.deepEqual(r.ids, ["pollo", "papa"]);
  assert.equal(r.otros[0], "rocoto"); assert.equal(r.otros.length, 15);
  assert.deepEqual(interpretarRespuesta(null, ingPorId), { ids: [], otros: [] });
});

test("mensajes de error claros para cada caso del servicio", () => {
  assert.match(mensajeError("no_autorizado"), /código de acceso/);
  assert.match(mensajeError("tope_mensual", { gastado_mes_usd: 1.98, tope_mes_usd: 2 }), /\$1\.98 de \$2\.00/);
  assert.match(mensajeError("limite_hora"), /hora/);
  assert.match(mensajeError("clave_api"), /console\.anthropic\.com/);
  assert.match(mensajeError("sin_conexion"), /conectar/);
  assert.match(mensajeError("algo_raro"), /Algo falló/);
  for (const c of ["configuracion", "anthropic_ocupado", "rechazado", "respuesta_invalida", "imagen_muy_grande", "tipo_de_imagen", "sin_configurar"]) assert.ok(mensajeError(c).length > 20, c);
});

test("una clave de API pegada donde va el código de acceso se detecta (y un código normal no)", () => {
  for (const clave of ["sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv", "  sk-ant-api03-xxxxxxxxxxxxxxxxxxxx", "sk-proj-abcdefghijklmnopqrstuvwx", "sk-ant-oat01-abcdefghijklm"]) assert.equal(pareceClaveApi(clave), true, clave);
  for (const ok of ["prueba123", "mi-familia-come-rico-2026", "casa-verde-luna-piedra", "", null, undefined, "task-force-uno-dos-tres"]) assert.equal(pareceClaveApi(ok), false, String(ok));
  assert.match(mensajeError("clave_en_codigo"), /CLAVE DE API/); assert.match(mensajeError("clave_en_codigo"), /Cloudflare/);
});
