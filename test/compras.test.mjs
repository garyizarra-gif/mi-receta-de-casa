import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcularCompras, factor, textoCompra } from "../app/src/compras.js";
import { crearSemana, agregar } from "../app/src/semana.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const ingredientes = leer("app/data/ingredientes.json");
const porId = new Map(platos.map((p) => [p.id, p]));
const ingPorId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));

const semana = (...cosas) => { // cosas: [dia, comida, campo, id]
  const s = crearSemana("2026-11-02");
  for (const [d, c, campo, id] of cosas) c === "cena" ? (s.dias[d].cena.apoyo = id) : agregar(s.dias[d][c], campo, id);
  return s;
};
const calc = (s, o = {}) => calcularCompras(s, porId, ingPorId, o);
const item = (r, id) => r.grupos.flatMap((g) => g.items).find((i) => i.id === id);

test("factores: desayuno x personas, almuerzo x2, lonchera siempre 1 niño", () => {
  assert.equal(factor("desayuno", "por_persona", 4), 4);
  assert.equal(factor("almuerzo", "por_persona", 4), 8);
  assert.equal(factor("almuerzo", "por_persona", 3), 6);
  assert.equal(factor("lonchera", "por_persona", 4), 1);
  assert.equal(factor("almuerzo", "por_litro", 4), 1);   // 1/4 L por persona
  assert.equal(factor("almuerzo", "por_litro", 3), 0.75);
  assert.equal(factor("lonchera", "por_litro", 4), 0.25);
  assert.equal(factor("cena", "por_licuado", 4), 1);
});

test("ají de gallina para 4: el almuerzo cuenta doble por la cena y se redondea a lo que se compra", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "A04"]), { personas: 4 });
  assert.equal(item(r, "pollo").texto, "1 kg");               // 120 g x 8 = 960 g
  assert.equal(item(r, "papa").texto, "1¼ kg");               // 150 g x 8 = 1200 g
  assert.equal(item(r, "leche_evaporada").texto, "1 lata");   // 50 ml x 8 = 400 ml
  assert.equal(item(r, "pan_molde").texto, "1 paquete");
  assert.equal(item(r, "aji_amarillo").texto, "200 g");
});
test("de 4 a 3 personas se recalcula", () => {
  const s = semana(["lunes", "almuerzo", "platos", "A04"]);
  assert.equal(item(calc(s, { personas: 3 }), "pollo").texto, "750 g"); // 720 g
  assert.equal(item(calc(s, { personas: 4 }), "pollo").texto, "1 kg");
});
test("la lonchera es para 1 niño aunque sean 4 personas", () => {
  const s = semana(["lunes", "lonchera", "platos", "L05"]);
  assert.equal(item(calc(s, { personas: 4 }), "huevo_codorniz").texto, "3 u");
  assert.equal(item(calc(s, { personas: 3 }), "huevo_codorniz").texto, "3 u");
});
test("ingredientes iguales de varios días se suman y se indica en qué días", () => {
  const r = calc(semana(["lunes", "desayuno", "platos", "D01"], ["martes", "desayuno", "platos", "D03"]), { personas: 4 });
  assert.equal(item(r, "huevo").texto, "16 u");               // 2 x 4 + 2 x 4
  assert.equal(item(r, "huevo").dias, "lun, mar");
});
test("las frutas se suman aunque salgan de formas distintas (plato, lonchera, refresco)", () => {
  const r = calc(semana(["lunes", "desayuno", "platos", "D10"], ["lunes", "lonchera", "frutas", "f_manzana"], ["lunes", "almuerzo", "bebidas", "r02"]), { personas: 4 });
  // D10: 150 g x4 = 600 + fruta lonchera 120 g + agua de manzana 300 g x 1 = 1020 g → 1¼ kg
  assert.equal(item(r, "manzana").texto, "1¼ kg");
});
test("refrescos: por litro, 1/4 L por persona", () => {
  const r = calc(semana(["lunes", "almuerzo", "bebidas", "r01"]), { personas: 4 });
  assert.equal(item(r, "cebada").texto, "50 g");              // 40 g
  assert.equal(item(r, "limon").texto, "50 g");
});
test("licuado de cena de apoyo: 1 jarra y 1 huevo, solo si se marcó", () => {
  const sin = calc(semana(["lunes", "almuerzo", "platos", "A26"]));
  assert.equal(item(sin, "papaya"), undefined);
  const con = calc(semana(["lunes", "cena", null, "c01"]));
  assert.equal(item(con, "papaya").texto, "300 g");
  assert.equal(item(con, "huevo").texto, "1 u");
});

test("atún en lata se cuenta en latas", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "A23"]), { personas: 4 }); // 60 g x 8 = 480 g
  assert.equal(item(r, "atun_lata").texto, "4 latas");
  assert.match(item(r, "atun_lata").necesita, /480 g/);
});
test("textoCompra: atado, litro y unidades desde gramos", () => {
  assert.equal(textoCompra(ingPorId.espinaca, 480, "g").texto, "2 atados");
  assert.equal(textoCompra(ingPorId.leche, 1100, "ml").texto, "1¼ L");
  assert.equal(textoCompra(ingPorId.palta, 160, "g").texto, "1 u");
  assert.equal(textoCompra(ingPorId.pan_frances, 7.5, "u").texto, "8 u");
});

// ---------- chilcano ----------
test("chilcano solo: se compran las cabezas", () => {
  const r = calc(semana(["miercoles", "almuerzo", "platos", "N01"]), { personas: 4 }); // 0.25 x 8 = 2 cabezas
  assert.equal(item(r, "cabeza_pescado").texto, "2 u");
});
test("chilcano después de un pescado entero: usa su cabeza y solo compra la que falta", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "A18"], ["martes", "almuerzo", "platos", "N01"]), { personas: 4 });
  assert.equal(item(r, "cabeza_pescado").texto, "1 u");
  assert.equal(r.avisos.filter((a) => a.tipo === "chilcano").length, 0);
});
test("chilcano cubierto por dos pescados enteros: no se compra cabeza", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "A18"], ["martes", "almuerzo", "platos", "A17"], ["martes", "lonchera", "platos", "L01"], ["miercoles", "almuerzo", "platos", "N01"]));
  assert.equal(item(r, "cabeza_pescado"), undefined);
  assert.equal(r.avisos.filter((a) => a.tipo === "chilcano").length, 1); // el del lunes queda a 2 días
});
test("chilcano un pescado del mismo día: sin aviso", () => {
  const r = calc(semana(["martes", "almuerzo", "platos", "A18"], ["martes", "desayuno", "platos", "D01"], ["martes", "almuerzo", "platos", "N01"], ["lunes", "almuerzo", "platos", "A17"]));
  assert.equal(item(r, "cabeza_pescado"), undefined);
  assert.equal(r.avisos.filter((a) => a.tipo === "chilcano").length, 0);
});
test("el pescado fresco posterior al chilcano no sirve de fuente", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "N01"], ["jueves", "almuerzo", "platos", "A18"]));
  assert.equal(item(r, "cabeza_pescado").texto, "2 u");
});

// ---------- tengo / comprado / básicos / avisos ----------
test("'ya tengo' saca el ingrediente de la lista y lo pasa a su sección", () => {
  const s = semana(["lunes", "almuerzo", "platos", "A04"]);
  const r = calc(s, { tengo: ["pollo"] });
  assert.equal(item(r, "pollo"), undefined);
  assert.deepEqual(r.yaTengo.map((x) => x.id), ["pollo"]);
});
test("'ya compré' marca y cuenta", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "A04"]), { comprado: ["papa", "pollo"] });
  assert.equal(item(r, "papa").comprado, true);
  assert.equal(r.compradosN, 2);
  assert.ok(r.total > 2);
});
test("los básicos van aparte y solo entran a la lista si el usuario marca que le faltan", () => {
  const s = semana(["lunes", "almuerzo", "platos", "A04"]);
  const r = calc(s);
  assert.ok(["aceite", "sal", "ajo"].every((id) => r.basicos.some((b) => b.id === id)));
  assert.equal(item(r, "aceite"), undefined);
  const r2 = calc(s, { basicosFaltan: ["sal"] });
  assert.equal(item(r2, "sal").basico, true);
  assert.equal(r2.grupos.at(-1).grupo, "Básicos");
});
test("plato propio sin ingredientes: avisa y no suma; plato tentativo: avisa", () => {
  const mio = { id: "U1", categoria: "almuerzo", nombre: "Mi arroz con leche", base: "por_persona", ingredientes: [] };
  const mapa = new Map(porId); mapa.set("U1", mio);
  const s = semana(["lunes", "almuerzo", "platos", "U1"], ["martes", "almuerzo", "platos", "A21"]);
  const r = calcularCompras(s, mapa, ingPorId, {});
  assert.ok(r.avisos.some((a) => a.tipo === "sin_ingredientes" && a.texto.includes("Mi arroz con leche")));
  assert.ok(r.avisos.some((a) => a.tipo === "tentativo"));
});
test("semana vacía: vacío = true", () => {
  assert.equal(calc(crearSemana("2026-11-02")).vacio, true);
});
test("grupos ordenados como el mercado: verduras antes que carnes antes que abarrotes", () => {
  const r = calc(semana(["lunes", "almuerzo", "platos", "A04"], ["lunes", "lonchera", "platos", "L03"]));
  const orden = r.grupos.map((g) => g.grupo);
  assert.ok(orden.indexOf("Verduras") < orden.indexOf("Carnes y pescados"));
  assert.ok(orden.indexOf("Carnes y pescados") < orden.indexOf("Abarrotes"));
});
