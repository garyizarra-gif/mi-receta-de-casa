// Compartir: textos para WhatsApp y documentos imprimibles (PDF vía "Guardar como PDF"). Lógica pura, sin DOM.
// Tres documentos: el menú de la semana, la lista de compras y la "hoja del día" para quien cocina.
import { DIAS, NOMBRE_DIA, COMIDAS, MESES, etiquetaSemana, sumarDias, textoComida } from "./semana.js";
import { factor } from "./compras.js";
import { escapar, num } from "./formato.js";

export const ICONO = { desayuno: "☀️", lonchera: "🎒", almuerzo: "🍽️", cena: "🌙" };
export const NOMBRE = { desayuno: "Desayuno", lonchera: "Lonchera", almuerzo: "Almuerzo", cena: "Cena" };
const SOBRANTE = "Sobrante del almuerzo";
export const FIRMA_TEXTO = "Elaborado por SystemIA · Cel. 965754455";

const aFecha = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export function fechaDia(lunesISO, dia) {
  const f = aFecha(sumarDias(lunesISO, DIAS.indexOf(dia)));
  return `${NOMBRE_DIA[dia].toLowerCase()} ${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`;
}
const personasTxt = (n) => `${n} personas`;
const nombresDe = (ids, porId) => ids.map((id) => porId.get(id)?.nombre ?? id);
const lleno = (c) => c.platos.length || c.bebidas.length || c.frutas.length || c.acomp.length;

// ---------- 1. Menú de la semana ----------
// Devuelve, por día, el texto de cada comida (o "" si no está armada).
export function filasMenu(semana, porId) {
  return DIAS.map((d) => {
    const dia = semana.dias[d];
    const apoyo = dia.cena.apoyo ? porId.get(dia.cena.apoyo)?.nombre : null;
    const fila = { dia: d, nombre: NOMBRE_DIA[d] };
    for (const c of COMIDAS) {
      const t = textoComida(dia[c], porId);
      fila[c] = lleno(dia[c]) ? [t.principal, t.extra].filter(Boolean).join(" · ") : "";
    }
    fila.cena = apoyo ? `${SOBRANTE} + ${apoyo}` : SOBRANTE;
    return fila;
  });
}
export function textoSemana(semana, porId, personas) {
  const l = [`🍽️ *MENÚ DE LA SEMANA* (${etiquetaSemana(semana.id)})`, `Para ${personasTxt(personas)} · lonchera: 1 niño`, ""];
  for (const f of filasMenu(semana, porId)) {
    l.push(`*${f.nombre}*`);
    for (const c of COMIDAS) l.push(`${ICONO[c]} ${NOMBRE[c]}: ${f[c] || "—"}`);
    l.push(`${ICONO.cena} Cena: ${f.cena}`, "");
  }
  return l.join("\n").trimEnd();
}

// ---------- 2. Lista de compras ----------
// `res` es el resultado de calcularCompras(...). Solo lo que falta comprar (no lo ya comprado ni lo que ya tengo).
export function textoCompras(res, semana, personas) {
  const l = [`🛒 *LISTA DE COMPRAS* (${etiquetaSemana(semana.id)})`, `Para ${personasTxt(personas)}`, ""];
  let n = 0;
  for (const g of res.grupos) {
    const items = g.items.filter((i) => !i.comprado);
    if (!items.length) continue;
    l.push(`*${g.grupo.toUpperCase()}*`);
    for (const i of items) { l.push(`• ${i.nombre} — ${i.texto}`); n++; }
    l.push("");
  }
  if (!n) l.push("No falta comprar nada. ✅", "");
  return l.join("\n").trimEnd();
}

// ---------- 3. Hoja del día (para quien cocina) ----------
// g y ml: a números enteros (12,5 g → 13 g); unidades: al cuarto más cercano (¼, ½, ¾).
export function cantidadCocina(cant, unidad) {
  if (unidad === "u") return `${num(Math.max(0.25, Math.round(cant * 4) / 4))} u`;
  return `${Math.max(1, Math.round(cant))} ${unidad}`;
}
const lineaIng = (ing, ingPorId, f) => {
  const nombre = ingPorId[ing.id]?.nombre ?? ing.id;
  return { nombre, texto: ing.cant == null ? "al gusto" : cantidadCocina(ing.cant * f, ing.unidad) };
};
// Cantidades YA multiplicadas por las porciones de esa comida.
export function detalleDia(semana, dia, porId, ingPorId, personas) {
  const d = semana.dias[dia];
  const comidas = [];
  const armar = (clave, nombre, para, items) => comidas.push({ clave, nombre, para, items });
  const items = (c, comida) => [...c.platos, ...c.acomp, ...c.frutas, ...c.bebidas].map((id) => porId.get(id)).filter(Boolean).map((p) => {
    const f = factor(comida, p.base, personas);
    const unidades = p.base === "por_litro" ? `${num(f)} litro(s)` : p.base === "por_licuado" ? "1 jarra" : `${num(f)} porción(es)`;
    return { nombre: p.nombre, porciones: unidades, ingredientes: p.ingredientes.map((i) => lineaIng(i, ingPorId, f)), sinIngredientes: !p.ingredientes.length };
  });
  if (lleno(d.desayuno)) armar("desayuno", "Desayuno", `para ${personasTxt(personas)}`, items(d.desayuno, "desayuno"));
  if (lleno(d.lonchera)) armar("lonchera", "Lonchera", "para 1 niño", items(d.lonchera, "lonchera"));
  if (lleno(d.almuerzo)) armar("almuerzo", "Almuerzo", `para ${personasTxt(personas)} + la cena (el doble)`, items(d.almuerzo, "almuerzo"));
  const apoyo = d.cena.apoyo ? porId.get(d.cena.apoyo) : null;
  armar("cena", "Cena", apoyo ? `${SOBRANTE.toLowerCase()} + licuado de apoyo` : SOBRANTE.toLowerCase(),
    apoyo ? [{ nombre: apoyo.nombre, porciones: "1 jarra", ingredientes: apoyo.ingredientes.map((i) => lineaIng(i, ingPorId, 1)), sinIngredientes: !apoyo.ingredientes.length }] : []);
  return { dia, titulo: `Hoja del día — ${fechaDia(semana.id, dia)}`, personas, comidas, vacio: !lleno(d.desayuno) && !lleno(d.lonchera) && !lleno(d.almuerzo) && !apoyo };
}
export function textoDia(det) {
  const l = [`👩‍🍳 *${det.titulo.toUpperCase()}*`, `Para ${personasTxt(det.personas)} (lonchera: 1 niño)`, ""];
  if (det.vacio) return l.concat("Este día todavía no tiene comidas armadas.").join("\n");
  for (const c of det.comidas) {
    l.push(`${ICONO[c.clave]} *${c.nombre}* — ${c.para}`);
    if (!c.items.length) l.push("   Se come lo que sobró del almuerzo.");
    for (const it of c.items) {
      l.push(`• ${it.nombre} (${it.porciones})`);
      l.push(it.sinIngredientes ? "   (sin lista de ingredientes)" : `   ${it.ingredientes.map((i) => `${i.nombre} ${i.texto}`).join(", ")}`);
    }
    l.push("");
  }
  return l.join("\n").trimEnd();
}

export const urlWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

// ---------- documentos imprimibles (HTML) ----------
const firmaHtml = `<footer class="firma">Elaborado por <span class="firma-logo"><img src="logo_systemia.png" alt="SystemIA" height="26" onerror="this.replaceWith(document.createTextNode('SystemIA'))"></span> · Cel. 965754455</footer>`;
const cabecera = (titulo, sub) => `<header class="doc-cab"><h1>Menú de casa</h1><h2>${escapar(titulo)}</h2>${sub ? `<p>${escapar(sub)}</p>` : ""}</header>`;
const doc = (cuerpo) => `<article class="doc">${cuerpo}${firmaHtml}</article>`;

export function htmlMenu(semana, porId, personas) {
  const filas = filasMenu(semana, porId).map((f) => `<tr><th>${escapar(f.nombre)}</th>${COMIDAS.map((c) => `<td>${f[c] ? escapar(f[c]) : "<span class='vacio'>—</span>"}</td>`).join("")}<td>${escapar(f.cena)}</td></tr>`).join("");
  return doc(`${cabecera(`Menú de la semana · ${etiquetaSemana(semana.id)}`, `Para ${personasTxt(personas)} · la lonchera es para 1 niño · la cena es el sobrante del almuerzo`)}
    <table class="doc-tabla"><thead><tr><th></th><th>☀️ Desayuno</th><th>🎒 Lonchera</th><th>🍽️ Almuerzo</th><th>🌙 Cena</th></tr></thead><tbody>${filas}</tbody></table>`);
}
export function htmlCompras(res, semana, personas) {
  const grupos = res.grupos.map((g) => {
    const items = g.items.filter((i) => !i.comprado);
    return items.length ? `<section class="doc-grupo"><h3>${escapar(g.grupo)}</h3><ul>${items.map((i) => `<li><span class="caja">☐</span><span class="dnom">${escapar(i.nombre)}${i.dias ? ` <small>${escapar(i.dias)}</small>` : ""}</span><span class="dcant">${escapar(i.texto)}</span></li>`).join("")}</ul></section>` : "";
  }).join("");
  return doc(`${cabecera(`Lista de compras · ${etiquetaSemana(semana.id)}`, `Para ${personasTxt(personas)}`)}${grupos ? `<div class="doc-compras">${grupos}</div>` : "<p>No falta comprar nada. ✅</p>"}`);
}
export function htmlDia(det) {
  const cuerpo = det.vacio ? "<p>Este día todavía no tiene comidas armadas.</p>" : det.comidas.map((c) => `
    <section class="doc-comida"><h3>${ICONO[c.clave]} ${escapar(c.nombre)} <small>${escapar(c.para)}</small></h3>
      ${c.items.length ? c.items.map((it) => `<div class="doc-plato"><h4>${escapar(it.nombre)} <small>${escapar(it.porciones)}</small></h4>
        ${it.sinIngredientes ? "<p class='vacio'>Sin lista de ingredientes.</p>" : `<ul class="doc-ings">${it.ingredientes.map((i) => `<li><span>${escapar(i.nombre)}</span><span>${escapar(i.texto)}</span></li>`).join("")}</ul>`}</div>`).join("") : "<p>Se come lo que sobró del almuerzo.</p>"}
    </section>`).join("");
  return doc(`${cabecera(det.titulo, `Para ${personasTxt(det.personas)} · lonchera: 1 niño`)}${cuerpo}`);
}
