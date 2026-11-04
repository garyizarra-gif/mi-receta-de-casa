import test from "node:test";
import assert from "node:assert/strict";
import { crearRespaldo, validarRespaldo, nombreArchivo, ingredientesFaltantes, VERSION, APP } from "../app/src/respaldo.js";
import { crearSemana, agregar } from "../app/src/semana.js";
import { construirPlato, borradorNuevo } from "../app/src/propios.js";

const plato = () => { const b = borradorNuevo("almuerzo"); b.nombre = "Mi guiso"; b.ingredientes = [{ id: "papa", cant: 100, unidad: "g" }, { id: "x_rocoto", cant: 20, unidad: "g" }]; b.marcas.verdura = true; return construirPlato(b, 1700000000000); };
const rocoto = { id: "x_rocoto", nombre: "Rocoto", grupo: "Verduras", compra: "kg", basico: false, peso_unidad_g: null, propio: true };
const buena = () => {
  const s = crearSemana("2026-11-02"); agregar(s.dias.lunes.almuerzo, "platos", plato().id); s.comprado = ["papa"]; s.dias.lunes.almuerzo.nota = "según mi menú";
  return crearRespaldo({ platos: [plato()], ingredientes: [rocoto], semanas: [s], ajustes: { personas: 3, despensa: ["arroz"], tab: "semana" } }, "2026-11-03T10:00:00.000Z");
};

test("nombre del archivo con la fecha", () => assert.equal(nombreArchivo("2026-11-03T10:00:00.000Z"), "menu-de-casa-2026-11-03.json"));

test("crear respaldo: marca de app y versión; solo ajustes permitidos", () => {
  const r = buena();
  assert.equal(r.app, APP); assert.equal(r.version, VERSION);
  assert.deepEqual(Object.keys(r.ajustes).sort(), ["despensa", "personas"]);   // 'tab' no se respalda
});

test("ida y vuelta: lo exportado se valida y se importa idéntico", () => {
  const original = buena();
  const v = validarRespaldo(JSON.parse(JSON.stringify(original)));
  assert.ok(v.ok, v.errores.join("; "));
  assert.deepEqual(v.datos.platos, original.platos_usuario);
  assert.deepEqual(v.datos.ingredientes, original.ingredientes_usuario);
  assert.deepEqual(v.datos.semanas, original.semanas);
  assert.deepEqual(v.datos.ajustes, { personas: 3, despensa: ["arroz"] });
  assert.deepEqual(v.resumen, { platos: 1, ingredientes: 1, semanas: 1, fecha: "2026-11-03" });
});

test("rechaza archivos que no son una copia de la app, y versiones futuras", () => {
  for (const malo of [null, [], 5, "x", {}, { app: "otra", version: 1 }]) assert.equal(validarRespaldo(malo).ok, false);
  assert.equal(validarRespaldo({ app: APP }).ok, false);
  const futura = validarRespaldo({ app: APP, version: VERSION + 1 });
  assert.equal(futura.ok, false); assert.match(futura.errores[0], /más nueva/);
});

test("rechaza datos corruptos y no los deja pasar", () => {
  const c = (f) => { const r = JSON.parse(JSON.stringify(buena())); f(r); return validarRespaldo(r); };
  assert.equal(c((r) => { r.platos_usuario[0].id = "A04"; }).ok, false);                 // id que no es de plato propio
  assert.equal(c((r) => { r.platos_usuario[0].categoria = "postre"; }).ok, false);
  assert.equal(c((r) => { r.platos_usuario[0].ingredientes[0].cant = -5; }).ok, false);
  assert.equal(c((r) => { r.platos_usuario[0].ingredientes[0].unidad = "kg"; }).ok, false);
  assert.equal(c((r) => { r.platos_usuario = "nada"; }).ok, false);
  assert.equal(c((r) => { r.ingredientes_usuario[0].id = "rocoto"; }).ok, false);
  assert.equal(c((r) => { r.ingredientes_usuario[0].grupo = "Joyas"; }).ok, false);
  assert.equal(c((r) => { r.semanas[0].id = "ayer"; }).ok, false);
  assert.equal(c((r) => { delete r.semanas[0].dias.martes; }).ok, false);
  assert.equal(c((r) => { r.semanas[0].dias.lunes.almuerzo.platos = [1, 2]; }).ok, false);
});

test("sanea: no deja pasar campos extra, ni scripts en nombres se vuelven código (solo texto)", () => {
  const r = JSON.parse(JSON.stringify(buena()));
  r.platos_usuario[0].nombre = "<img src=x onerror=alert(1)>";
  r.platos_usuario[0].campo_raro = "x"; r.platos_usuario[0].__proto__ = { admin: true };
  r.ajustes.personas = 99; r.ajustes.tab = "hack";
  const v = validarRespaldo(r);
  assert.ok(v.ok);
  assert.equal(v.datos.platos[0].campo_raro, undefined);
  assert.equal(v.datos.platos[0].admin, undefined);
  assert.equal(v.datos.ajustes.personas, undefined);                                      // 99 no es 3 ni 4 → se ignora
  assert.equal(v.datos.platos[0].nombre, "<img src=x onerror=alert(1)>");                 // queda como texto; la pantalla lo escapa
});

test("recorta textos largos y limita cantidades de elementos", () => {
  const r = JSON.parse(JSON.stringify(buena()));
  r.platos_usuario[0].nombre = "a".repeat(500);
  assert.equal(validarRespaldo(r).datos.platos[0].nombre.length, 80);
  r.platos_usuario = Array.from({ length: 501 }, () => plato());
  assert.equal(validarRespaldo(r).ok, false);
});

test("detecta ingredientes que usan los platos y no existen en ninguna parte", () => {
  const v = validarRespaldo(JSON.parse(JSON.stringify(buena())));
  assert.deepEqual(ingredientesFaltantes(v.datos, ["papa"]), []);
  const sinRocoto = JSON.parse(JSON.stringify(buena())); sinRocoto.ingredientes_usuario = [];
  assert.deepEqual(ingredientesFaltantes(validarRespaldo(sinRocoto).datos, ["papa"]), ["x_rocoto"]);
});

test("un plato con básicos 'al gusto' (cantidad nula) viaja bien en la copia", () => {
  const r = JSON.parse(JSON.stringify(buena()));
  r.platos_usuario[0].ingredientes.push({ id: "aceite", cant: null, unidad: null });
  const v = validarRespaldo(r);
  assert.ok(v.ok, v.errores.join("; "));
  assert.deepEqual(v.datos.platos[0].ingredientes.at(-1), { id: "aceite", cant: null, unidad: null });
  r.platos_usuario[0].ingredientes.push({ id: "papa", cant: "mucho", unidad: "g" });   // texto en vez de número: sigue siendo inválido
  assert.equal(validarRespaldo(r).ok, false);
});
