import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsearCantidad, unidadPorDefecto, nuevoIdPlato, nuevoIdIngrediente, borradorNuevo, borradorDesde, validarBorrador, construirPlato,
  ingredienteNuevo, semanasQueUsan, quitarPlatoDeSemana, CATEGORIAS_PROPIAS,
} from "../app/src/propios.js";
import { crearSemana, agregar } from "../app/src/semana.js";
import { calcularCompras } from "../app/src/compras.js";
import { CATEGORIAS } from "../app/src/formato.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const ingredientes = leer("app/data/ingredientes.json");
const ingPorId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));

test("las categorías propias coinciden con las de la app y con la base/porción del catálogo", () => {
  assert.deepEqual(CATEGORIAS_PROPIAS.map((c) => c.id).sort(), CATEGORIAS.map((c) => c.id).sort());
  for (const c of CATEGORIAS_PROPIAS) {
    const muestra = platos.find((p) => p.categoria === c.id);
    assert.equal(muestra.base, c.base, `base de ${c.id}`);
    assert.equal(muestra.porcion, c.porcion, `porción de ${c.id}`);
  }
});

test("parsearCantidad: coma, fracciones y valores inválidos", () => {
  assert.equal(parsearCantidad("120"), 120);
  assert.equal(parsearCantidad("1,5"), 1.5);
  assert.equal(parsearCantidad(" 1/2 "), 0.5);
  for (const malo of ["", "abc", "0", "-3", "1/0", null, "1e9"]) assert.equal(parsearCantidad(malo), null, String(malo));
});
test("unidad por defecto según cómo se compra", () => {
  assert.equal(unidadPorDefecto(ingPorId.leche), "ml");
  assert.equal(unidadPorDefecto(ingPorId.huevo), "u");
  assert.equal(unidadPorDefecto(ingPorId.pollo), "g");
});
test("ids: de plato único y de ingrediente sin choques", () => {
  assert.match(nuevoIdPlato(1700000000000, () => 0.123456), /^U[a-z0-9]+$/);
  assert.notEqual(nuevoIdPlato(1, () => 0.1), nuevoIdPlato(1, () => 0.9));
  assert.equal(nuevoIdIngrediente("Ají panca (molido)", new Set()), "x_aji_panca_molido");
  assert.equal(nuevoIdIngrediente("Sal", new Set(["x_sal", "x_sal_2"])), "x_sal_3");
});

test("validar borrador: nombre, cantidades, repetidos y existencia", () => {
  const b = borradorNuevo("almuerzo");
  assert.equal(validarBorrador(b, ingPorId).ok, false);                       // sin nombre
  b.nombre = "Arroz con leche";
  assert.equal(validarBorrador(b, ingPorId).ok, true);                        // sin ingredientes es válido
  b.ingredientes = [{ id: "arroz", cant: 0, unidad: "g" }];
  assert.match(validarBorrador(b, ingPorId).errores[0].texto, /cantidad/i);
  b.ingredientes = [{ id: "arroz", cant: 50, unidad: "g" }, { id: "arroz", cant: 10, unidad: "g" }];
  assert.ok(validarBorrador(b, ingPorId).errores.some((e) => /repetido/.test(e.texto)));
  b.ingredientes = [{ id: "no_existe", cant: 5, unidad: "g" }];
  assert.ok(validarBorrador(b, ingPorId).errores.some((e) => /no existe/.test(e.texto)));
  b.ingredientes = [{ id: "arroz", cant: 50, unidad: "kilos" }];
  assert.ok(validarBorrador(b, ingPorId).errores.some((e) => /Unidad/.test(e.texto)));
});

test("construir plato: toma base y porción de la categoría y empieza como estimado", () => {
  const b = borradorNuevo("refresco"); b.nombre = "  Chicha de jora  "; b.ingredientes = [{ id: "azucar", cant: 50, unidad: "g" }];
  const p = construirPlato(b, 1700000000000);
  assert.equal(p.nombre, "Chicha de jora"); assert.equal(p.base, "por_litro"); assert.equal(p.porcion, "1 litro (4 vasos)");
  assert.equal(p.estado, "estimado"); assert.match(p.id, /^U/);
  assert.equal(construirPlato({ ...b, id: "Uabc" }).id, "Uabc");               // editar conserva el id
});
test("duplicar un plato del catálogo crea una copia editable con otro nombre y sin id", () => {
  const a04 = platos.find((p) => p.id === "A04");
  const b = borradorDesde(a04, { copia: true });
  assert.equal(b.id, null); assert.equal(b.nombre, "Ají de gallina (mío)");
  b.ingredientes[0].cant = 999;
  assert.notEqual(a04.ingredientes[0].cant, 999);                              // copia profunda
  assert.equal(borradorDesde({ ...a04, id: "Uxyz" }).id, "Uxyz");
});

test("ingrediente nuevo: validaciones y duplicados (sin importar tildes)", () => {
  const ids = new Set(Object.keys(ingPorId)), nombres = ingredientes.map((i) => i.nombre);
  assert.equal(ingredienteNuevo({ nombre: "A", grupo: "Verduras", compra: "kg" }, ids, nombres).ok, false);
  assert.equal(ingredienteNuevo({ nombre: "Rocoto", grupo: "Otro", compra: "kg" }, ids, nombres).ok, false);
  assert.equal(ingredienteNuevo({ nombre: "Rocoto", grupo: "Verduras", compra: "metro" }, ids, nombres).ok, false);
  assert.equal(ingredienteNuevo({ nombre: "ZANAHORIA", grupo: "Verduras", compra: "kg" }, ids, nombres).ok, false);
  const r = ingredienteNuevo({ nombre: "Rocoto", grupo: "Verduras", compra: "kg" }, ids, nombres);
  assert.ok(r.ok); assert.equal(r.ing.id, "x_rocoto"); assert.equal(r.ing.propio, true);
});

test("un plato propio con ingredientes (y uno propio) SÍ suma a las compras y pasa por el redondeo", () => {
  const rocoto = ingredienteNuevo({ nombre: "Rocoto", grupo: "Verduras", compra: "kg" }, new Set(Object.keys(ingPorId)), []).ing;
  const ings = { ...ingPorId, [rocoto.id]: rocoto };
  const b = borradorNuevo("almuerzo"); b.nombre = "Rocoto relleno casero";
  b.ingredientes = [{ id: "x_rocoto", cant: 100, unidad: "g" }, { id: "carne_molida", cant: 80, unidad: "g" }];
  const mio = construirPlato(b);
  const s = crearSemana("2026-11-02"); agregar(s.dias.lunes.almuerzo, "platos", mio.id);
  const r = calcularCompras(s, new Map([[mio.id, mio]]), ings, { personas: 4 });
  const todos = r.grupos.flatMap((g) => g.items);
  assert.equal(todos.find((i) => i.id === "x_rocoto").texto, "800 g");        // 100 x 8
  assert.equal(todos.find((i) => i.id === "carne_molida").texto, "650 g");    // 640 → paso de 50
  assert.equal(r.avisos.length, 0);                                           // ya no avisa "sin ingredientes"
});

test("borrar un plato propio: se detecta y se quita de las semanas", () => {
  const a = crearSemana("2026-11-02"), b = crearSemana("2026-11-09");
  agregar(a.dias.lunes.almuerzo, "platos", "Uabc"); agregar(a.dias.martes.almuerzo, "platos", "A04"); a.dias.jueves.cena.apoyo = "Uabc";
  assert.deepEqual(semanasQueUsan([a, b], "Uabc"), ["2026-11-02"]);
  const r = quitarPlatoDeSemana(a, "Uabc");
  assert.equal(r.cambio, true);
  assert.deepEqual(r.semana.dias.lunes.almuerzo.platos, []);
  assert.equal(r.semana.dias.jueves.cena.apoyo, null);
  assert.deepEqual(r.semana.dias.martes.almuerzo.platos, ["A04"]);
  assert.deepEqual(a.dias.lunes.almuerzo.platos, ["Uabc"]);                   // no muta la original
  assert.equal(quitarPlatoDeSemana(b, "Uabc").cambio, false);
});

test("los básicos (aceite, sal, ajo) pueden ir 'al gusto' sin cantidad; los demás no", () => {
  const b = borradorNuevo("almuerzo"); b.nombre = "Guiso";
  b.ingredientes = [{ id: "aceite", cant: null, unidad: "g" }, { id: "ajo", cant: null, unidad: "g" }, { id: "papa", cant: 100, unidad: "g" }];
  assert.equal(validarBorrador(b, ingPorId).ok, true);
  b.ingredientes.push({ id: "pollo", cant: null, unidad: "g" });
  assert.match(validarBorrador(b, ingPorId).errores[0].texto, /Falta la cantidad de “Pollo/);
});
test("duplicar un plato del catálogo con básicos se puede validar y guardar tal cual", () => {
  const a04 = platos.find((p) => p.id === "A04");
  const b = borradorDesde(a04, { copia: true });
  assert.ok(b.ingredientes.some((i) => i.cant == null));                      // trae básicos al gusto
  assert.equal(validarBorrador(b, ingPorId).ok, true);
  const p = construirPlato(b);
  assert.deepEqual(p.ingredientes.filter((i) => i.cant == null).map((i) => i.unidad), p.ingredientes.filter((i) => i.cant == null).map(() => null));
  assert.equal(p.ingredientes.length, a04.ingredientes.length);
});
