import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIAS } from "../app/src/formato.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const ings = leer("app/data/ingredientes.json");
const ingIds = new Set(ings.map((i) => i.id));

test("los datos de la app cargan completos (fase 1)", () => {
  assert.equal(platos.length, 173);
  assert.equal(ings.length, 118);
});

test("la app tiene los mismos datos que datos/ (si falla: correr scripts/f2_preparar_app.py)", () => {
  assert.deepEqual(platos, leer("datos/recetas_f1.json"));
  assert.deepEqual(ings, leer("datos/ingredientes.json"));
});

test("ids únicos", () => {
  assert.equal(new Set(platos.map((p) => p.id)).size, platos.length);
  assert.equal(ingIds.size, ings.length);
});

test("todo ingrediente de una receta existe en el maestro", () => {
  for (const p of platos) for (const i of p.ingredientes) assert.ok(ingIds.has(i.id), `${p.id} usa '${i.id}' que no existe`);
});

test("solo los básicos pueden ir sin cantidad; unidades válidas", () => {
  const basico = new Map(ings.map((i) => [i.id, i.basico]));
  for (const p of platos) for (const i of p.ingredientes) {
    if (i.cant == null) assert.ok(basico.get(i.id), `${p.id}: '${i.id}' sin cantidad y no es básico`);
    else assert.ok(["g", "ml", "u"].includes(i.unidad) && i.cant > 0, `${p.id}: cantidad inválida ${JSON.stringify(i)}`);
  }
});

test("toda categoría de plato está declarada en la app y ninguna queda vacía", () => {
  const declaradas = new Set(CATEGORIAS.map((c) => c.id));
  for (const p of platos) assert.ok(declaradas.has(p.categoria), `${p.id} tiene categoría desconocida '${p.categoria}'`);
  for (const c of declaradas) assert.ok(platos.some((p) => p.categoria === c), `categoría vacía: ${c}`);
});

test("las variantes apuntan a un plato base que existe", () => {
  const ids = new Set(platos.map((p) => p.id));
  for (const p of platos.filter((x) => x.variante_de)) assert.ok(ids.has(p.variante_de), `${p.id} → ${p.variante_de}`);
});

test("todo plato empieza como estimado (nada aprobado sin que el usuario lo diga)", () => {
  for (const p of platos) assert.equal(p.estado, "estimado");
});
