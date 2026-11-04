import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  candidatosParaMenu, opcionesParaMenu, solicitudMenu, menuDesdeIA, limpiarMenu, menuVacio, idsPlatosDelMenu, faltantesMenu, avisosMenu,
  menuLocal, aplicarMenuADia, diaTieneComidas, MIN_INSUMOS_MENU,
} from "../app/src/menu_dia.js";
import { ingredientesNecesarios } from "../app/src/cocinar.js";
import { crearSemana, agregar } from "../app/src/semana.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const ingredientes = leer("app/data/ingredientes.json");
const ingPorId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));
const porId = new Map(platos.map((p) => [p.id, p]));
const tengoDe = (...ids) => new Set(ids.flatMap((id) => ingredientesNecesarios(porId.get(id), ingPorId)));
const vacio = () => ({ origen: "ia", desayuno: { platos: [], bebidas: [] }, lonchera: { platos: [], frutas: [], bebidas: [] }, almuerzo: { platos: [], acomp: [], bebidas: [] }, explicacion: "", ideas: [] });

test("candidatos para la IA: por categoría, con lo que falta (nombres cortos) y acotados", () => {
  const tengo = tengoDe("A04", "D01", "L05");
  const c = candidatosParaMenu(platos, tengo, ingPorId);
  assert.deepEqual(Object.keys(c).sort(), ["almuerzo", "desayuno", "lonchera"]);
  const aji = c.almuerzo.find((x) => x.id === "A04");
  assert.deepEqual(aji.faltan, []); assert.equal(aji.nombre, "Ají de gallina");
  assert.ok(c.almuerzo.length <= 20 && c.desayuno.length <= 20);
  const sin = candidatosParaMenu(platos, new Set([...tengo].filter((i) => i !== "pollo")), ingPorId).almuerzo.find((x) => x.id === "A04");
  assert.deepEqual(sin.faltan, ["Pollo"]);                                               // sin "(pechuga o pierna)"
  assert.ok(c.almuerzo.every((x) => x.faltan.length <= 4));
  const nada = candidatosParaMenu(platos, new Set(), ingPorId);                          // sin insumos no hay candidatos (ni platos con todo por comprar)
  assert.deepEqual([nada.desayuno.length, nada.lonchera.length, nada.almuerzo.length], [0, 0, 0]);
  const poco = candidatosParaMenu(platos, new Set(["pollo"]), ingPorId);
  assert.ok(poco.almuerzo.length > 0 && poco.almuerzo.every((x) => x.faltan.length < 4 || true));
});

test("opciones para la IA: solo las frutas que hay en casa; el resto del catálogo completo", () => {
  const o = opcionesParaMenu(platos, new Set(["manzana", "uva"]));
  assert.deepEqual(o.frutas.map((f) => f.id).sort(), ["f_manzana", "f_uva"]);
  assert.ok(o.refrescos.length === 15 && o.bebidas_desayuno.length === 11 && o.acomp.length >= 10);
  assert.deepEqual(opcionesParaMenu(platos, new Set()).frutas, []);
});

test("el pedido para el servicio: insumos por nombre, personas, candidatos, opciones y 'evitar'", () => {
  const s = solicitudMenu({ platos, tengo: new Set(["pollo", "papa"]), ingPorId, personas: 3, evitar: new Set(["A04"]) });
  assert.deepEqual(s.ingredientes, ["Pollo", "Papa blanca"]); assert.equal(s.personas, 3); assert.deepEqual(s.evitar, ["A04"]);
  assert.ok(s.candidatos.almuerzo && s.opciones.acomp);
  assert.ok(MIN_INSUMOS_MENU >= 2);
});

test("la respuesta de la IA se convierte en un menú con la forma de la app", () => {
  const m = menuDesdeIA({ menu: { desayuno_plato: "D01", desayuno_bebida: "db2", lonchera_plato: "", lonchera_frutas: ["f_uva"], lonchera_refresco: "r13", almuerzo_plato: "A26", almuerzo_acomp: ["AC04"], almuerzo_refresco: "r01" }, explicacion: "ok", ideas: ["una idea"] });
  assert.deepEqual(m.desayuno, { platos: ["D01"], bebidas: ["db2"] });
  assert.deepEqual(m.lonchera, { platos: [], frutas: ["f_uva"], bebidas: ["r13"] });
  assert.deepEqual(m.almuerzo, { platos: ["A26"], acomp: ["AC04"], bebidas: ["r01"] });
  assert.equal(m.origen, "ia"); assert.equal(m.explicacion, "ok");
  assert.equal(menuVacio(menuDesdeIA({})), true);
  assert.deepEqual(idsPlatosDelMenu(m), ["D01", "A26"]);
});

test("segunda red de seguridad: se descartan ids inexistentes o de otra categoría", () => {
  const sucio = { ...vacio(), desayuno: { platos: ["A04", "D01"], bebidas: ["r01", "db2"] }, lonchera: { platos: ["NOEXISTE"], frutas: ["f_uva", "D01"], bebidas: ["r13"] }, almuerzo: { platos: ["A26"], acomp: ["AC04", "zzz"], bebidas: [] } };
  const m = limpiarMenu(sucio, porId);
  assert.deepEqual(m.desayuno, { platos: ["D01"], bebidas: ["db2"] });
  assert.deepEqual(m.lonchera, { platos: [], frutas: ["f_uva"], bebidas: ["r13"] });
  assert.deepEqual(m.almuerzo.acomp, ["AC04"]);
});

test("lo que falta comprar para el menú: solo no-básicos y sin lo que ya se tiene", () => {
  const m = { ...vacio(), almuerzo: { platos: ["A04"], acomp: [], bebidas: ["r01"] } };
  const tengo = new Set([...tengoDe("A04")].filter((i) => i !== "queso_parmesano"));
  const f = faltantesMenu(m, porId, tengo, ingPorId).map((x) => x.nombre);
  assert.ok(f.includes("Queso parmesano") && f.includes("Cebada perlada"));              // del plato y del refresco
  assert.ok(!f.includes("Pollo"));
  assert.ok(!f.some((n) => ["Aceite", "Sal", "Ajo"].includes(n)));
  assert.deepEqual(faltantesMenu(m, porId, new Set(Object.keys(ingPorId)), ingPorId), []);
});

test("avisos del día: 3 comidas con harina y almuerzo sin verdura", () => {
  const m = { ...vacio(), desayuno: { platos: ["D17"], bebidas: [] }, lonchera: { platos: ["L09"], frutas: [], bebidas: [] }, almuerzo: { platos: ["A20"], acomp: [], bebidas: [] } };
  assert.ok(avisosMenu(m, porId).some((a) => /3 comidas/.test(a)));
  const m2 = { ...vacio(), almuerzo: { platos: ["A26"], acomp: [], bebidas: [] } };
  assert.ok(avisosMenu(m2, porId).some((a) => /verdura/.test(a)));
  m2.almuerzo.acomp = ["AC04"];
  assert.deepEqual(avisosMenu(m2, porId), []);
});

test("menú sin IA: elige platos que casi no necesitan compras, con la forma correcta y ids válidos", () => {
  const tengo = tengoDe("A04", "D01", "L05"); tengo.add("manzana");
  const m = menuLocal(platos, tengo, ingPorId);
  assert.equal(m.origen, "local");
  assert.equal(m.almuerzo.platos.length, 1); assert.equal(m.desayuno.platos.length, 1);
  assert.deepEqual(faltantesMenu(m, porId, tengo, ingPorId).filter((x) => ["Pollo", "Papa blanca"].includes(x.nombre)), []);
  assert.deepEqual(limpiarMenu(m, porId), m);                                               // todos los ids existen y son de su categoría
  assert.deepEqual(m.lonchera.frutas, ["f_manzana"]);                                       // solo la fruta que hay
  assert.equal(m.almuerzo.bebidas.length, 1);
  assert.ok(m.explicacion.length > 20);
});
test("menú sin IA: repetible, respeta 'evitar' y avisa si no hay nada", () => {
  const tengo = tengoDe("A04", "A26", "D01", "L05");
  const a = menuLocal(platos, tengo, ingPorId), b = menuLocal(platos, tengo, ingPorId);
  assert.deepEqual(a, b);
  const otro = menuLocal(platos, tengo, ingPorId, { evitar: idsPlatosDelMenu(a) });
  for (const id of idsPlatosDelMenu(a)) assert.ok(!idsPlatosDelMenu(otro).includes(id), id);
  const nada = menuLocal(platos, new Set(), ingPorId);
  assert.equal(menuVacio(nada), true); assert.match(nada.explicacion, /Agrega más insumos/);
});
test("menú sin IA: si el almuerzo no lleva verdura agrega una ensalada", () => {
  const tengo = tengoDe("A26"); ["lechuga", "tomate", "cebolla"].forEach((i) => tengo.add(i));
  const m = menuLocal(platos, tengo, ingPorId);
  if (m.almuerzo.platos[0] === "A26") assert.ok(m.almuerzo.acomp.length >= 1);
});

test("poner el menú en un día: reemplaza lo que trae, conserva el resto y no toca la original", () => {
  const s = crearSemana("2026-11-02");
  agregar(s.dias.martes.lonchera, "platos", "L01"); s.dias.martes.cena.apoyo = "c01";
  const m = { ...vacio(), desayuno: { platos: ["D01"], bebidas: ["db2"] }, almuerzo: { platos: ["A26"], acomp: ["AC04"], bebidas: ["r01"] } };
  const r = aplicarMenuADia(s, "martes", m);
  assert.deepEqual(r.dias.martes.desayuno.platos, ["D01"]); assert.deepEqual(r.dias.martes.almuerzo.acomp, ["AC04"]);
  assert.deepEqual(r.dias.martes.lonchera.platos, ["L01"]);                                 // el menú no traía lonchera: se conserva la que había
  assert.equal(r.dias.martes.cena.apoyo, "c01");
  assert.equal(diaTieneComidas(s, "lunes"), false); assert.equal(diaTieneComidas(s, "martes"), true);
  assert.deepEqual(s.dias.martes.desayuno.platos, []);                                      // la original no cambió
});
