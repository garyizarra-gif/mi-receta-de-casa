import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cantidadCocina, fechaDia, filasMenu, textoSemana, textoCompras, detalleDia, textoDia, urlWhatsApp, htmlMenu, htmlCompras, htmlDia, FIRMA_TEXTO,
} from "../app/src/compartir.js";
import { calcularCompras } from "../app/src/compras.js";
import { crearSemana, agregar } from "../app/src/semana.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const ingredientes = leer("app/data/ingredientes.json");
const porId = new Map(platos.map((p) => [p.id, p]));
const ingPorId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));

const semana = () => {
  const s = crearSemana("2026-11-02");
  agregar(s.dias.lunes.desayuno, "platos", "D01"); agregar(s.dias.lunes.desayuno, "bebidas", "db2");
  agregar(s.dias.lunes.lonchera, "platos", "L05"); agregar(s.dias.lunes.lonchera, "frutas", "f_mandarina");
  agregar(s.dias.lunes.almuerzo, "platos", "A04"); agregar(s.dias.lunes.almuerzo, "acomp", "AC01"); agregar(s.dias.lunes.almuerzo, "bebidas", "r01");
  agregar(s.dias.martes.almuerzo, "platos", "A15");
  s.dias.martes.cena.apoyo = "c01";
  return s;
};
const compras = (s, o = {}) => calcularCompras(s, porId, ingPorId, { personas: 4, ...o });

test("fechaDia: día de la semana con su fecha, también al cruzar de mes", () => {
  assert.equal(fechaDia("2026-11-02", "lunes"), "lunes 2 nov");
  assert.equal(fechaDia("2026-11-02", "viernes"), "viernes 6 nov");
  assert.equal(fechaDia("2026-11-30", "jueves"), "jueves 3 dic");
});

test("texto del menú: cabecera, días, comidas armadas y vacías, y cena sobrante", () => {
  const t = textoSemana(semana(), porId, 4);
  assert.match(t, /^🍽️ \*MENÚ DE LA SEMANA\* \(2 – 6 nov\)\nPara 4 personas · lonchera: 1 niño/);
  assert.match(t, /\*Lunes\*\n☀️ Desayuno: Omelet de zanahoria con atún y palta · Leche de almendras\n🎒 Lonchera: Huevo de codorniz · Mandarina\n🍽️ Almuerzo: Ají de gallina · Arroz blanco · Agua de cebada\n🌙 Cena: Sobrante del almuerzo/);
  assert.match(t, /\*Miércoles\*\n☀️ Desayuno: —/);                                      // día sin armar
  assert.match(t, /🌙 Cena: Sobrante del almuerzo \+ Licuado de papaya con plátano/);    // martes con licuado de apoyo
  assert.equal(filasMenu(semana(), porId).length, 5);
});

test("texto de compras: por grupo, solo lo que falta (sin lo comprado ni lo que ya tengo)", () => {
  const s = semana();
  const todo = textoCompras(compras(s), s, 4);
  assert.match(todo, /^🛒 \*LISTA DE COMPRAS\* \(2 – 6 nov\)\nPara 4 personas/);
  assert.match(todo, /\*VERDURAS\*/); assert.match(todo, /\*CARNES Y PESCADOS\*/);
  assert.match(todo, /• Pollo \(pechuga o pierna\) — 2 kg/);
  const sin = textoCompras(compras(s, { comprado: ["pollo"], tengo: ["papa"] }), s, 4);
  assert.doesNotMatch(sin, /Pollo \(pechuga/);                                         // ya comprado
  assert.doesNotMatch(sin, /Papa blanca/);                                             // ya la tengo
  assert.match(textoCompras(compras(crearSemana("2026-11-02")), crearSemana("2026-11-02"), 4), /No falta comprar nada/);
});

test("hoja del día: porciones y cantidades YA multiplicadas (almuerzo x2, lonchera 1 niño)", () => {
  const det = detalleDia(semana(), "lunes", porId, ingPorId, 4);
  assert.equal(det.titulo, "Hoja del día — lunes 2 nov");
  const alm = det.comidas.find((c) => c.clave === "almuerzo");
  assert.match(alm.para, /4 personas \+ la cena/);
  const aji = alm.items.find((i) => i.nombre === "Ají de gallina");
  assert.equal(aji.porciones, "8 porción(es)");
  assert.deepEqual(aji.ingredientes.find((i) => i.nombre.startsWith("Pollo")), { nombre: "Pollo (pechuga o pierna)", texto: "960 g" });
  assert.equal(aji.ingredientes.find((i) => i.nombre === "Aceite").texto, "al gusto");
  const ref = alm.items.find((i) => i.nombre === "Agua de cebada");
  assert.equal(ref.porciones, "1 litro(s)");
  assert.equal(ref.ingredientes.find((i) => i.nombre.startsWith("Cebada")).texto, "40 g");
  const lon = det.comidas.find((c) => c.clave === "lonchera");
  assert.equal(lon.para, "para 1 niño");
  assert.equal(lon.items.find((i) => i.nombre === "Huevo de codorniz").ingredientes[0].texto, "3 u");
  const des = det.comidas.find((c) => c.clave === "desayuno");
  assert.equal(des.items[0].ingredientes.find((i) => i.nombre === "Huevo").texto, "8 u");   // 2 x 4 personas
});
test("hoja del día con 3 personas y con licuado de cena", () => {
  const d3 = detalleDia(semana(), "lunes", porId, ingPorId, 3);
  assert.equal(d3.comidas.find((c) => c.clave === "almuerzo").items[0].porciones, "6 porción(es)");
  const m = detalleDia(semana(), "martes", porId, ingPorId, 4);
  const cena = m.comidas.find((c) => c.clave === "cena");
  assert.match(cena.para, /licuado de apoyo/);
  assert.equal(cena.items[0].ingredientes.find((i) => i.nombre === "Huevo").texto, "1 u");
  const j = detalleDia(semana(), "jueves", porId, ingPorId, 4);
  assert.equal(j.vacio, true);
  assert.match(textoDia(j), /todavía no tiene comidas armadas/);
});
test("texto de la hoja del día", () => {
  const t = textoDia(detalleDia(semana(), "lunes", porId, ingPorId, 4));
  assert.match(t, /^👩‍🍳 \*HOJA DEL DÍA — LUNES 2 NOV\*\nPara 4 personas \(lonchera: 1 niño\)/);
  assert.match(t, /🍽️ \*Almuerzo\* — para 4 personas \+ la cena \(el doble\)\n• Ají de gallina \(8 porción\(es\)\)\n   Pollo \(pechuga o pierna\) 960 g,/);
  assert.match(t, /🌙 \*Cena\* — sobrante del almuerzo\n   Se come lo que sobró del almuerzo\./);
});
test("una receta sin ingredientes (plato propio) se avisa en la hoja y no rompe", () => {
  const s = crearSemana("2026-11-02"); agregar(s.dias.lunes.almuerzo, "platos", "U1");
  const mapa = new Map(porId); mapa.set("U1", { id: "U1", nombre: "Mi arroz con leche", base: "por_persona", ingredientes: [] });
  const det = detalleDia(s, "lunes", mapa, ingPorId, 4);
  assert.match(textoDia(det), /\(sin lista de ingredientes\)/);
  assert.match(htmlDia(det), /Sin lista de ingredientes/);
});

test("enlace de WhatsApp con el texto codificado", () => {
  const u = urlWhatsApp("*Hola*\nmundo & más");
  assert.equal(u, "https://wa.me/?text=" + encodeURIComponent("*Hola*\nmundo & más"));
  assert.ok(!u.includes("\n") && !u.includes(" "));
});

test("documentos imprimibles: llevan la firma, la tabla y escapan HTML", () => {
  const s = semana();
  const m = htmlMenu(s, porId, 4);
  assert.match(m, /<h2>Menú de la semana · 2 – 6 nov<\/h2>/);
  assert.equal((m.match(/<tr>/g) || []).length, 1 + 5);                                // encabezado + 5 días
  assert.match(m, /Elaborado por <span class="firma-logo"><img src="logo_systemia.png" alt="SystemIA" height="26"/);
  assert.match(m, /· Cel\. 965754455<\/footer>/);
  assert.equal(FIRMA_TEXTO, "Elaborado por SystemIA · Cel. 965754455");
  const mapa = new Map(porId); mapa.set("A04", { ...porId.get("A04"), nombre: "<img src=x onerror=alert(1)>" });
  const malo = htmlMenu(s, mapa, 4);
  assert.ok(!malo.includes("<img src=x"));
  assert.ok(malo.includes("&lt;img src=x onerror=alert(1)&gt;"));
});
test("documento de compras: sin lo comprado, con casillas y con días", () => {
  const s = semana();
  const h = htmlCompras(compras(s, { comprado: ["pollo"] }), s, 4);
  assert.ok(!h.includes("Pollo (pechuga"));
  assert.match(h, /<span class="caja">☐<\/span>/); assert.match(h, /<h3>Verduras<\/h3>/); assert.match(h, /<small>lun/);
  assert.match(htmlCompras(compras(crearSemana("2026-11-02")), crearSemana("2026-11-02"), 4), /No falta comprar nada/);
});
test("documento de la hoja del día", () => {
  const h = htmlDia(detalleDia(semana(), "lunes", porId, ingPorId, 4));
  assert.match(h, /<h2>Hoja del día — lunes 2 nov<\/h2>/);
  assert.match(h, /Ají de gallina <small>8 porción\(es\)<\/small>/);
  assert.match(h, /<span>Pollo \(pechuga o pierna\)<\/span><span>960 g<\/span>/);
  assert.match(h, /class="firma"/);
});

test("cantidades de cocina: enteros para g/ml y cuartos para unidades", () => {
  assert.equal(cantidadCocina(12.5, "g"), "13 g");
  assert.equal(cantidadCocina(0.3, "g"), "1 g");
  assert.equal(cantidadCocina(960, "g"), "960 g");
  assert.equal(cantidadCocina(250.4, "ml"), "250 ml");
  assert.equal(cantidadCocina(0.5, "u"), "½ u");
  assert.equal(cantidadCocina(0.3, "u"), "¼ u");
  assert.equal(cantidadCocina(2, "u"), "2 u");
  assert.equal(cantidadCocina(2.6, "u"), "2½ u");
  assert.equal(cantidadCocina(2.7, "u"), "2¾ u");
  const s = crearSemana("2026-11-02"); agregar(s.dias.lunes.lonchera, "bebidas", "r05");
  const ref = detalleDia(s, "lunes", porId, ingPorId, 4).comidas.find((c) => c.clave === "lonchera").items[0];
  assert.equal(ref.ingredientes.find((i) => i.nombre === "Azúcar").texto, "13 g");          // 50 g x 0,25 litro = 12,5 g
});
test("compras imprimibles: dos columnas y clases propias del documento", () => {
  const s = semana();
  const h = htmlCompras(compras(s), s, 4);
  assert.match(h, /<div class="doc-compras">/); assert.match(h, /<span class="dnom">/); assert.match(h, /<span class="dcant">/);
  assert.ok(!/class="nom"/.test(h) && !/class="cant"/.test(h));        // no chocan con los estilos de la pantalla de Compras
});
