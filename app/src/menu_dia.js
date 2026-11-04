// Menú del día a partir de lo que hay en casa (lógica pura). Dos caminos que dan la MISMA forma de menú:
//  - con IA: el servicio privado le pide a Claude que elija entre platos candidatos del catálogo;
//  - sin IA (`menuLocal`): una regla sencilla, sin internet, que prefiere pocos faltantes y un día equilibrado.
// Forma de un menú: { origen, desayuno:{platos,bebidas}, lonchera:{platos,frutas,bebidas}, almuerzo:{platos,acomp,bebidas}, explicacion, ideas }
import { coincidencias, ingredientesNecesarios } from "./cocinar.js";
import { DIAS, ORDEN_REFRESCOS, comidaVacia, textoComida } from "./semana.js";

export const MIN_INSUMOS_MENU = 3;
const nombreCorto = (ing, id) => (ing?.nombre ?? id).replace(/\s*\(.*\)\s*$/, "");
const harinas = (p) => (p?.marcas?.harina || []).length > 0;

// ---------- pedido a la IA ----------
export function candidatosParaMenu(platos, tengo, ingPorId, { max = 20, maxFaltan = 4 } = {}) {
  const por = (cat) => coincidencias(platos, tengo, ingPorId, { categoria: cat, maxFaltan }).filter((r) => r.tiene >= 1).slice(0, max)   // un plato sin NINGÚN ingrediente en casa no es una opción
    .map((r) => ({ id: r.plato.id, nombre: r.plato.nombre, faltan: r.faltan.map((id) => nombreCorto(ingPorId[id], id)) }));
  return { desayuno: por("desayuno"), lonchera: por("lonchera"), almuerzo: por("almuerzo") };
}
export function opcionesParaMenu(platos, tengo) {
  const de = (cat) => platos.filter((p) => p.categoria === cat).map((p) => ({ id: p.id, nombre: p.nombre }));
  // Solo las frutas que de verdad hay en casa (la fruta se identifica por su único ingrediente).
  const frutas = platos.filter((p) => p.categoria === "fruta_lonchera" && p.ingredientes.length && tengo.has(p.ingredientes[0].id)).map((p) => ({ id: p.id, nombre: p.nombre }));
  return { acomp: de("acompanamiento"), bebidas_desayuno: de("bebida_desayuno"), frutas, refrescos: de("refresco") };
}
export function solicitudMenu({ platos, tengo, ingPorId, personas = 4, evitar = [] }) {
  return {
    ingredientes: [...tengo].map((id) => nombreCorto(ingPorId[id], id)), personas,
    candidatos: candidatosParaMenu(platos, tengo, ingPorId), opciones: opcionesParaMenu(platos, tengo), evitar: [...evitar],
  };
}

// ---------- respuesta de la IA -> menú ----------
const una = (id) => (id ? [id] : []);
const CAT = { platosDes: "desayuno", platosLon: "lonchera", platosAlm: "almuerzo", bebDes: "bebida_desayuno", frutas: "fruta_lonchera", acomp: "acompanamiento", refresco: "refresco" };
export function menuDesdeIA(resp) {
  const m = resp?.menu || {};
  return {
    origen: "ia",
    desayuno: { platos: una(m.desayuno_plato), bebidas: una(m.desayuno_bebida) },
    lonchera: { platos: una(m.lonchera_plato), frutas: m.lonchera_frutas || [], bebidas: una(m.lonchera_refresco) },
    almuerzo: { platos: una(m.almuerzo_plato), acomp: m.almuerzo_acomp || [], bebidas: una(m.almuerzo_refresco) },
    explicacion: String(resp?.explicacion || ""), ideas: Array.isArray(resp?.ideas) ? resp.ideas : [],
  };
}
// Segunda red de seguridad en la app: solo ids que existen y son de la categoría correcta.
export function limpiarMenu(menu, porId) {
  const ok = (id, cat) => porId.get(id)?.categoria === cat;
  const f = (ids, cat) => (ids || []).filter((id) => ok(id, cat));
  return { ...menu,
    desayuno: { platos: f(menu.desayuno.platos, CAT.platosDes), bebidas: f(menu.desayuno.bebidas, CAT.bebDes) },
    lonchera: { platos: f(menu.lonchera.platos, CAT.platosLon), frutas: f(menu.lonchera.frutas, CAT.frutas), bebidas: f(menu.lonchera.bebidas, CAT.refresco) },
    almuerzo: { platos: f(menu.almuerzo.platos, CAT.platosAlm), acomp: f(menu.almuerzo.acomp, CAT.acomp), bebidas: f(menu.almuerzo.bebidas, CAT.refresco) } };
}
export const menuVacio = (m) => !["desayuno", "lonchera", "almuerzo"].some((c) => m[c].platos.length);
export const idsPlatosDelMenu = (m) => ["desayuno", "lonchera", "almuerzo"].flatMap((c) => m[c].platos);

// ---------- lo que falta y avisos del día ----------
const todosLosIds = (m) => ["desayuno", "lonchera", "almuerzo"].flatMap((c) => [...m[c].platos, ...(m[c].bebidas || []), ...(m[c].frutas || []), ...(m[c].acomp || [])]);
export function faltantesMenu(menu, porId, tengo, ingPorId) {
  const falta = new Set();
  for (const id of todosLosIds(menu)) { const p = porId.get(id); if (p) for (const i of ingredientesNecesarios(p, ingPorId)) if (!tengo.has(i)) falta.add(i); }
  return [...falta].map((id) => ({ id, nombre: nombreCorto(ingPorId[id], id) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
export function avisosMenu(menu, porId) {
  const av = [];
  const marcasDe = (c) => [...menu[c].platos, ...(menu[c].acomp || [])].map((id) => porId.get(id)).filter(Boolean);
  const conHarina = ["desayuno", "lonchera", "almuerzo"].filter((c) => marcasDe(c).some(harinas)).length;
  if (conHarina >= 3) av.push("Las 3 comidas llevan arroz, fideo, pan o harina. Prueba cambiar una por verdura, camote o menestra.");
  if (menu.almuerzo.platos.length && !marcasDe("almuerzo").some((p) => p.marcas?.verdura)) av.push("El almuerzo no tiene verdura. Agrega una ensalada.");
  return av;
}

// ---------- menú sin IA ----------
export function menuLocal(platos, tengo, ingPorId, { evitar = [], porId = new Map(platos.map((p) => [p.id, p])) } = {}) {
  const ev = new Set(evitar);
  const top = (cat) => coincidencias(platos, tengo, ingPorId, { categoria: cat, maxFaltan: 6 }).filter((r) => r.tiene >= 1 && !ev.has(r.plato.id)).slice(0, 8);
  const opc = (arr) => (arr.length ? arr : [null]);
  let mejor = null, mejorPuntos = Infinity;
  for (const d of opc(top("desayuno"))) for (const l of opc(top("lonchera"))) for (const a of opc(top("almuerzo"))) {
    const sel = [d, l, a].filter(Boolean);
    if (!sel.length) continue;
    const faltan = new Set(sel.flatMap((r) => r.faltan)).size;
    const conHarina = sel.filter((r) => harinas(r.plato)).length;
    const pescado = sel.some((r) => r.plato.marcas?.pescado && r.plato.marcas.pescado !== "ninguno") ? -0.6 : 0;
    const menestra = a?.plato.marcas?.menestra ? -0.4 : 0;
    const sinVerdura = a && !a.plato.marcas?.verdura ? 0.8 : 0;
    const puntos = faltan * 3 + (conHarina >= 3 ? 4 : 0) + sinVerdura + pescado + menestra;
    if (puntos < mejorPuntos) { mejorPuntos = puntos; mejor = { d, l, a }; }
  }
  const menu = { origen: "local", desayuno: { platos: [], bebidas: [] }, lonchera: { platos: [], frutas: [], bebidas: [] }, almuerzo: { platos: [], acomp: [], bebidas: [] }, explicacion: "", ideas: [] };
  if (!mejor) { menu.explicacion = "Con lo que marcaste no encontré platos del catálogo. Agrega más insumos."; return menu; }
  if (mejor.d) menu.desayuno.platos = [mejor.d.plato.id];
  if (mejor.l) menu.lonchera.platos = [mejor.l.plato.id];
  if (mejor.a) menu.almuerzo.platos = [mejor.a.plato.id];
  const faltanDe = (p) => ingredientesNecesarios(p, ingPorId).filter((i) => !tengo.has(i)).length;
  const mejores = (cat, n, filtro = () => true) => platos.filter((p) => p.categoria === cat && filtro(p)).sort((x, y) => faltanDe(x) - faltanDe(y) || (ORDEN_REFRESCOS.indexOf(x.id) + 99 * (ORDEN_REFRESCOS.indexOf(x.id) < 0)) - (ORDEN_REFRESCOS.indexOf(y.id) + 99 * (ORDEN_REFRESCOS.indexOf(y.id) < 0))).slice(0, n);
  menu.desayuno.bebidas = mejores("bebida_desayuno", 1).map((p) => p.id);
  menu.lonchera.frutas = platos.filter((p) => p.categoria === "fruta_lonchera" && p.ingredientes.length && tengo.has(p.ingredientes[0].id)).slice(0, 2).map((p) => p.id);
  const refrescos = mejores("refresco", 2);
  menu.almuerzo.bebidas = refrescos.slice(0, 1).map((p) => p.id);
  menu.lonchera.bebidas = refrescos.slice(1, 2).map((p) => p.id);
  if (mejor.a && !mejor.a.plato.marcas?.verdura) menu.almuerzo.acomp = mejores("acompanamiento", 1, (p) => p.marcas?.verdura && faltanDe(p) <= 2).map((p) => p.id);
  menu.explicacion = `Armé este día con lo que tienes, buscando que falten pocos insumos${mejorPuntos < 3 ? "" : " y que no se cargue de harinas"}. Sin la IA no puedo explicar más: úsala para un menú con criterio de nutrición.`;
  return menu;
}

// ---------- poner el menú en un día de la semana ----------
const clon = (x) => JSON.parse(JSON.stringify(x));
export function aplicarMenuADia(semana, dia, menu) {
  const s = clon(semana);
  for (const c of ["desayuno", "lonchera", "almuerzo"]) {
    if (!menu[c].platos.length && !(menu[c].bebidas || []).length) continue;
    s.dias[dia][c] = { ...comidaVacia(), platos: [...menu[c].platos], bebidas: [...(menu[c].bebidas || [])], frutas: [...(menu[c].frutas || [])], acomp: [...(menu[c].acomp || [])] };
  }
  return s;
}
export function diaTieneComidas(semana, dia) {
  return ["desayuno", "lonchera", "almuerzo"].some((c) => { const x = semana.dias[dia][c]; return x.platos.length || x.bebidas.length || x.frutas.length || x.acomp.length; });
}
// Texto corto de una comida del menú, para mostrar en la tarjeta.
export function textoDeComidaMenu(c, porId) { return textoComida({ ...comidaVacia(), ...c }, porId); }
export { DIAS };
