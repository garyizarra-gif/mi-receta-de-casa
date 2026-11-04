// Lógica pura de la lista de compras (sin DOM). Reglas acordadas con el usuario:
//  - desayuno: por persona; lonchera: SIEMPRE para 1 niño; almuerzo: por persona x2 (la cena es el sobrante).
//  - refrescos: 1/4 de litro por persona (almuerzo) o por niño (lonchera). Licuado de cena: 1 jarra, 1 huevo.
//  - los ingredientes iguales se suman en un solo renglón y se redondean a lo que realmente se compra.
//  - el chilcano usa la cabeza de un pescado entero comprado antes en la semana; si no hay, se compra aparte.
import { DIAS, COMIDAS } from "./semana.js";
import { num } from "./formato.js";

export const PLATOS_PESCADO_ENTERO = ["A17", "A18"]; // sudado y frito: de ahí sale la cabeza del chilcano
export const ID_CABEZA = "cabeza_pescado";
export const ORDEN_GRUPOS = ["Verduras", "Frutas", "Tubérculos", "Carnes y pescados", "Lácteos y huevos", "Menestras y granos", "Fideos", "Panadería", "Abarrotes", "Básicos"];
const CORTO = { lunes: "lun", martes: "mar", miercoles: "mié", jueves: "jue", viernes: "vie" };
const NOMBRE_LARGO = { lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes" };
const PLURAL = { atado: "atados", lata: "latas", bandeja: "bandejas", frasco: "frascos", bolsa: "bolsas", paquete: "paquetes", botella: "botellas", cabeza: "cabezas" };

// Cuántas "porciones base" de una receta hay que preparar según la comida y la base de la receta.
export function factor(comida, base, personas) {
  if (base === "por_licuado") return 1;
  if (base === "por_litro") return comida === "lonchera" ? 0.25 : personas * 0.25;
  if (comida === "lonchera") return 1;
  if (comida === "almuerzo") return personas * 2;
  return personas; // desayuno
}

// Recorre la semana y suma ingredientes. Devuelve { totales: Map(id -> {total, unidad, dias:Set}), avisos }.
export function acumular(semana, porId, personas) {
  const totales = new Map();
  const avisos = [];
  const fuentesPescado = []; // { idxDia, usada }
  const chilcanos = [];      // { idxDia, dia, necesita }
  const sinIng = new Set(), tentativos = new Set();

  DIAS.forEach((dia, idx) => {
    const d = semana.dias[dia];
    const comidas = COMIDAS.map((c) => [c, d[c]]);
    const usos = [];
    for (const [c, x] of comidas) for (const id of [...x.platos, ...x.acomp, ...x.frutas, ...x.bebidas]) usos.push([c, id]);
    if (d.cena.apoyo) usos.push(["cena", d.cena.apoyo]);

    for (const [c, id] of usos) {
      const p = porId.get(id);
      if (!p) continue;
      if (PLATOS_PESCADO_ENTERO.includes(id)) fuentesPescado.push({ idx, usada: false });
      if (!p.ingredientes.length) { sinIng.add(p.nombre); continue; }
      if (p.revisar) tentativos.add(p.nombre);
      const f = factor(c, p.base, personas);
      for (const ing of p.ingredientes) {
        if (ing.cant == null) { sumar(totales, ing.id, null, null, dia); continue; } // básico "al gusto"
        const cant = ing.cant * f;
        if (ing.id === ID_CABEZA) { chilcanos.push({ idx, dia, necesita: cant }); continue; }
        sumar(totales, ing.id, cant, ing.unidad, dia);
      }
    }
  });

  // Chilcano: cada pescado entero anterior (o del mismo día) aporta 1 cabeza.
  for (const ch of chilcanos) {
    let faltan = ch.necesita;
    for (const fp of fuentesPescado) {
      if (faltan <= 0) break;
      if (fp.usada || fp.idx > ch.idx) continue;
      fp.usada = true; faltan -= 1;
      if (ch.idx - fp.idx > 1) avisos.push({ tipo: "chilcano", texto: `El chilcano del ${NOMBRE_LARGO[ch.dia].toLowerCase()} usa la cabeza de un pescado comprado antes. Cocina el chilcano el mismo día o al siguiente de comprar el pescado.` });
    }
    if (faltan > 0) sumar(totales, ID_CABEZA, faltan, "u", ch.dia);
  }
  for (const n of sinIng) avisos.push({ tipo: "sin_ingredientes", texto: `Falta agregar los ingredientes de “${n}”: todavía no suma a las compras.` });
  for (const n of tentativos) avisos.push({ tipo: "tentativo", texto: `“${n}” tiene una lista de ingredientes tentativa.` });
  return { totales, avisos };
}

function sumar(mapa, id, cant, unidad, dia) {
  const e = mapa.get(id) || { total: 0, unidad: null, dias: new Set(), soloBasico: true };
  if (cant != null) { e.total += cant; e.unidad = unidad; e.soloBasico = false; }
  e.dias.add(dia);
  mapa.set(id, e);
}

// ---------- redondeo a unidad de compra ----------
const techo = (x, paso) => Math.ceil(x / paso - 1e-9) * paso;
const pesoTxt = (g) => {
  const r = g >= 1000 ? techo(g, 250) : techo(Math.max(g, 1), 50);
  return r >= 1000 ? `${num(r / 1000)} kg` : `${r} g`;
};
const canonTxt = (t, unidad) => (unidad === "u" ? `${num(Math.round(t * 100) / 100)} u` : `${Math.round(t)} ${unidad}`);

export function textoCompra(ing, total, unidad) {
  const peso = ing.peso_unidad_g;
  switch (ing.compra) {
    case "kg": return { texto: pesoTxt(unidad === "u" && peso ? total * peso : total), necesita: "" };
    case "litro": return { texto: `${num(techo(total, 250) / 1000)} L`, necesita: "" };
    case "u": case "docena": {
      const n = Math.ceil((unidad === "u" ? total : total / peso) - 1e-9);
      return { texto: `${n} u`, necesita: "" };
    }
    default: { // atado, lata, bandeja, frasco, bolsa, paquete, botella, cabeza
      if (!peso) return { texto: canonTxt(total, unidad), necesita: "" };
      const n = Math.ceil(total / peso - 1e-9);
      return { texto: `${n} ${n === 1 ? ing.compra : PLURAL[ing.compra] || ing.compra}`, necesita: `necesitas ${canonTxt(total, unidad)}` };
    }
  }
}

// ---------- resultado para la pantalla ----------
// opciones: { personas, tengo: [ids], comprado: [ids], basicosFaltan: [ids] }
export function calcularCompras(semana, porId, ingPorId, { personas = 4, tengo = [], comprado = [], basicosFaltan = [] } = {}) {
  const { totales, avisos } = acumular(semana, porId, personas);
  const setTengo = new Set(tengo), setComp = new Set(comprado), setFalta = new Set(basicosFaltan);
  const grupos = new Map(), yaTengo = [], basicos = [];
  const dias = (s) => DIAS.filter((d) => s.has(d)).map((d) => CORTO[d]).join(", ");

  for (const [id, e] of totales) {
    const ing = ingPorId[id];
    if (!ing) continue;
    if (ing.basico) {
      const falta = setFalta.has(id);
      basicos.push({ id, nombre: ing.nombre, falta });
      if (!falta) continue;
      push(grupos, "Básicos", { id, nombre: ing.nombre, texto: "te falta", necesita: "", dias: dias(e.dias), comprado: setComp.has(id), basico: true });
      continue;
    }
    if (e.soloBasico) continue;
    if (setTengo.has(id)) { yaTengo.push({ id, nombre: ing.nombre }); continue; }
    const c = textoCompra(ing, e.total, e.unidad);
    push(grupos, ing.grupo, { id, nombre: ing.nombre, texto: c.texto, necesita: c.necesita, dias: dias(e.dias), comprado: setComp.has(id) });
  }
  const orden = [...grupos.keys()].sort((a, b) => ORDEN_GRUPOS.indexOf(a) - ORDEN_GRUPOS.indexOf(b));
  const lista = orden.map((g) => ({ grupo: g, items: grupos.get(g).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) }));
  const items = lista.flatMap((g) => g.items);
  return {
    personas, grupos: lista, yaTengo: yaTengo.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    basicos: basicos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")), avisos,
    total: items.length, compradosN: items.filter((i) => i.comprado).length,
    vacio: totales.size === 0 && avisos.length === 0,
  };
}
function push(m, g, item) { if (!m.has(g)) m.set(g, []); m.get(g).push(item); }
