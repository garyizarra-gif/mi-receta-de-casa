import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  lunesDe, sumarDias, semanaPorDefecto, etiquetaSemana, crearSemana, semanaEstaVacia, copiarSemana, aplicarPlantilla,
  vaciarSemana, agregar, quitar, sugerirRefrescos, resumenSemana, textoComida, UMBRALES, DIAS, COMIDAS,
} from "../app/src/semana.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const platos = leer("app/data/platos.json");
const plantillas = leer("app/data/plantillas.json");
const porId = new Map(platos.map((p) => [p.id, p]));

test("fechas: el lunes de cualquier día de la semana", () => {
  assert.equal(lunesDe("2026-11-02"), "2026-11-02"); // lunes
  assert.equal(lunesDe("2026-11-03"), "2026-11-02"); // martes
  assert.equal(lunesDe("2026-11-08"), "2026-11-02"); // domingo
  assert.equal(sumarDias("2026-12-30", 3), "2027-01-02");
});
test("semana por defecto: sábado y domingo apuntan a la próxima", () => {
  assert.equal(semanaPorDefecto("2026-11-03"), "2026-11-02");
  assert.equal(semanaPorDefecto("2026-11-07"), "2026-11-09");
  assert.equal(semanaPorDefecto("2026-11-08"), "2026-11-09");
});
test("etiqueta de semana, también cuando cruza de mes", () => {
  assert.equal(etiquetaSemana("2026-11-02"), "2 – 6 nov");
  assert.equal(etiquetaSemana("2026-11-30"), "30 nov – 4 dic");
});

test("crear semana: 5 días x 3 comidas vacías y cena sobrante", () => {
  const s = crearSemana("2026-11-02");
  assert.equal(Object.keys(s.dias).length, 5);
  assert.ok(semanaEstaVacia(s));
  assert.equal(s.dias.lunes.cena.apoyo, null);
});
test("agregar / quitar no duplica y deja la semana con datos", () => {
  const s = crearSemana("2026-11-02");
  agregar(s.dias.lunes.almuerzo, "platos", "A04"); agregar(s.dias.lunes.almuerzo, "platos", "A04");
  assert.deepEqual(s.dias.lunes.almuerzo.platos, ["A04"]);
  assert.ok(!semanaEstaVacia(s));
  quitar(s.dias.lunes.almuerzo, "platos", "A04");
  assert.ok(semanaEstaVacia(s));
});
test("copiar semana: nuevo id, copia profunda y sin notas", () => {
  const a = crearSemana("2026-11-02");
  agregar(a.dias.martes.desayuno, "platos", "D01"); a.dias.martes.desayuno.nota = "texto";
  const b = copiarSemana(a, "2026-11-09");
  assert.equal(b.id, "2026-11-09");
  assert.deepEqual(b.dias.martes.desayuno.platos, ["D01"]);
  assert.equal(b.dias.martes.desayuno.nota, undefined);
  b.dias.martes.desayuno.platos.push("D02");
  assert.deepEqual(a.dias.martes.desayuno.platos, ["D01"]);
});

test("plantillas: todos los ids existen y pertenecen a la categoría correcta", () => {
  const CAT = { platos: { desayuno: "desayuno", lonchera: "lonchera", almuerzo: "almuerzo" },
    bebidas: { desayuno: "bebida_desayuno", lonchera: "refresco", almuerzo: "refresco" },
    frutas: { lonchera: "fruta_lonchera" }, acomp: { desayuno: "acompanamiento", almuerzo: "acompanamiento" } };
  assert.ok(plantillas.length >= 10);
  for (const p of plantillas) for (const [dia, cs] of Object.entries(p.dias)) {
    assert.ok(DIAS.includes(dia));
    for (const t of COMIDAS) for (const campo of ["platos", "bebidas", "frutas", "acomp"]) for (const id of cs[t][campo]) {
      assert.ok(porId.has(id), `${p.id} ${dia} ${t}: ${id} no existe`);
      assert.equal(porId.get(id).categoria, CAT[campo][t], `${p.id} ${dia} ${t}.${campo}: ${id}`);
    }
  }
});
test("aplicar plantilla: conserva los platos y deja vacíos los días que la plantilla no trae", () => {
  const pl = plantillas.find((p) => Object.keys(p.dias).length < 5);
  const s = aplicarPlantilla(crearSemana("2026-11-02"), pl);
  const falta = DIAS.find((d) => !pl.dias[d]);
  for (const c of COMIDAS) assert.deepEqual(s.dias[falta][c].platos, []);
  const dia = Object.keys(pl.dias)[0];
  assert.deepEqual(s.dias[dia].almuerzo.platos, pl.dias[dia].almuerzo.platos);
  assert.equal(s.id, "2026-11-02");
  assert.ok(semanaEstaVacia(vaciarSemana(s)));
});

test("refrescos: uno distinto por día, sin repetir el de la lonchera, sin pisar los ya elegidos", () => {
  const s = crearSemana("2026-11-02");
  s.dias.martes.almuerzo.bebidas = ["r05"];
  s.dias.lunes.lonchera.bebidas = ["r13"]; // limonada en la lonchera del lunes → el almuerzo del lunes no puede ser limonada
  const r = sugerirRefrescos(s);
  const alm = DIAS.map((d) => r.dias[d].almuerzo.bebidas);
  assert.ok(alm.every((b) => b.length === 1));
  assert.deepEqual(r.dias.martes.almuerzo.bebidas, ["r05"]);
  assert.notEqual(r.dias.lunes.almuerzo.bebidas[0], "r13");
  assert.equal(new Set(alm.flat()).size, 5);
  assert.deepEqual(s.dias.lunes.almuerzo.bebidas, []); // no modifica la original
});

// ---------- resumen ----------
const dia = (s, d, c, campo, ...ids) => ids.forEach((i) => agregar(s.dias[d][c], campo, i));
const estado = (res, id) => res.find((r) => r.id === id);

test("resumen: semana vacía = todo pendiente", () => {
  assert.ok(resumenSemana(crearSemana("2026-11-02"), porId).every((r) => r.estado === "pendiente"));
});
test("resumen harinas: día con 3 comidas con harina avisa; papa y camote no cuentan", () => {
  const s = crearSemana("2026-11-02");
  dia(s, "lunes", "desayuno", "platos", "D17");     // pan rebosado (pan)
  dia(s, "lunes", "lonchera", "platos", "L09");     // panqueque (harina)
  dia(s, "lunes", "almuerzo", "platos", "A20");     // tallarín saltado (fideo)
  const r = estado(resumenSemana(s, porId), "harinas");
  assert.equal(r.estado, "aviso"); assert.match(r.mensaje, /Lunes/);

  const t = crearSemana("2026-11-09");
  dia(t, "lunes", "desayuno", "platos", "D11");     // papa con huevo (sin harina)
  dia(t, "lunes", "lonchera", "platos", "L07");     // choclo con queso y papita
  dia(t, "lunes", "almuerzo", "platos", "A41");     // pollo al sillao con camote
  assert.equal(estado(resumenSemana(t, porId), "harinas").estado, "ok");
});
test("resumen harinas: el arroz de un acompañamiento también cuenta", () => {
  const s = crearSemana("2026-11-02");
  dia(s, "lunes", "desayuno", "platos", "D17");
  dia(s, "lunes", "lonchera", "platos", "L19");     // pan con huevo frito
  dia(s, "lunes", "almuerzo", "platos", "A26"); dia(s, "lunes", "almuerzo", "acomp", "AC01"); // asado de pollo + arroz
  assert.equal(estado(resumenSemana(s, porId), "harinas").estado, "aviso");
});
test("resumen harinas: arroz en más de 3 días y fideo en más de 2", () => {
  const s = crearSemana("2026-11-02");
  for (const d of ["lunes", "martes", "miercoles", "jueves"]) dia(s, d, "almuerzo", "platos", "A25"); // arroz con pollo
  assert.match(estado(resumenSemana(s, porId), "harinas").mensaje, /arroz 4 días/);
  const t = crearSemana("2026-11-02");
  for (const d of ["lunes", "martes", "miercoles"]) dia(t, d, "almuerzo", "platos", "A20"); // tallarín saltado
  assert.match(estado(resumenSemana(t, porId), "harinas").mensaje, /fideo 3 días/);
});
test("resumen pescado: camuflado cuenta; menos de 2 días avisa", () => {
  const s = crearSemana("2026-11-02");
  dia(s, "lunes", "desayuno", "platos", "D08");     // tortilla de atún (camuflado)
  assert.equal(estado(resumenSemana(s, porId), "pescado").estado, "aviso");
  dia(s, "jueves", "almuerzo", "platos", "N01");    // chilcano (visible)
  assert.equal(estado(resumenSemana(s, porId), "pescado").estado, "ok");
});
test("resumen menestras: 2 almuerzos con menestras", () => {
  const s = crearSemana("2026-11-02");
  dia(s, "lunes", "almuerzo", "platos", "A15");
  assert.equal(estado(resumenSemana(s, porId), "menestras").estado, "aviso");
  dia(s, "martes", "almuerzo", "platos", "A14");
  assert.equal(estado(resumenSemana(s, porId), "menestras").estado, "ok");
});
test("resumen verduras: avisa los almuerzos armados sin verdura; la ensalada lo arregla; los días vacíos no cuentan", () => {
  const s = crearSemana("2026-11-02");
  dia(s, "lunes", "almuerzo", "platos", "A26");     // asado de pollo (sin verdura)
  let r = estado(resumenSemana(s, porId), "verduras");
  assert.equal(r.estado, "aviso"); assert.match(r.mensaje, /Lunes/); assert.doesNotMatch(r.mensaje, /Martes/);
  dia(s, "lunes", "almuerzo", "acomp", "AC04");
  assert.equal(estado(resumenSemana(s, porId), "verduras").estado, "ok");
});
test("umbrales configurables", () => {
  const s = crearSemana("2026-11-02");
  dia(s, "lunes", "desayuno", "platos", "D08");
  assert.equal(estado(resumenSemana(s, porId, { ...UMBRALES, pescadoDias: 1 }), "pescado").estado, "ok");
});

test("textoComida junta platos, acompañamientos, frutas y bebidas", () => {
  const c = { platos: ["A04"], acomp: ["AC01"], frutas: [], bebidas: ["r01"], };
  const t = textoComida(c, porId);
  assert.equal(t.principal, "Ají de gallina");
  assert.equal(t.extra, "Arroz blanco · Agua de cebada");
});
