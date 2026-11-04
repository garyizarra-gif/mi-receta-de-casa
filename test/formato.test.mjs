import test from "node:test";
import assert from "node:assert/strict";
import { num, formatoCantidad, normalizar, filtrarPlatos, etiquetas, escapar } from "../app/src/formato.js";

test("num: fracciones y decimales en español", () => {
  assert.equal(num(2), "2");
  assert.equal(num(0.5), "½");
  assert.equal(num(0.25), "¼");
  assert.equal(num(1.5), "1½");
  assert.equal(num(0.3), "0,3");
});

test("formatoCantidad", () => {
  assert.equal(formatoCantidad({ cant: 120, unidad: "g" }), "120 g");
  assert.equal(formatoCantidad({ cant: 0.5, unidad: "u" }), "½ u");
  assert.equal(formatoCantidad({ cant: null, unidad: null }), "al gusto");
});

test("normalizar quita tildes y mayúsculas", () => {
  assert.equal(normalizar("  Ají de GALLINA "), "aji de gallina");
});

const muestra = [
  { id: "A04", nombre: "Ají de gallina", categoria: "almuerzo" },
  { id: "D01", nombre: "Omelet de zanahoria con atún y palta", categoria: "desayuno" },
  { id: "A23", nombre: "Tallarín rojo con atún", categoria: "almuerzo" },
];
test("filtrarPlatos por categoría y por texto sin importar tildes", () => {
  assert.equal(filtrarPlatos(muestra, { categoria: "almuerzo" }).length, 2);
  assert.deepEqual(filtrarPlatos(muestra, { texto: "ATUN" }).map((p) => p.id), ["D01", "A23"]);
  assert.deepEqual(filtrarPlatos(muestra, { categoria: "desayuno", texto: "atun" }).map((p) => p.id), ["D01"]);
  assert.equal(filtrarPlatos(muestra, { texto: "zzz" }).length, 0);
});

test("etiquetas: pescado camuflado, harina y tentativo", () => {
  const e = etiquetas({ marcas: { pescado: "camuflado", harina: ["f"], menestra: false, verdura: false, camote: false }, revisar: "x" });
  assert.deepEqual(e.map((x) => x.texto), ["pescado camuflado", "fideo", "tentativo"]);
  assert.deepEqual(etiquetas({ marcas: null }), []);
});

test("escapar neutraliza HTML", () => {
  assert.equal(escapar('<b>"x"</b>'), "&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
});
