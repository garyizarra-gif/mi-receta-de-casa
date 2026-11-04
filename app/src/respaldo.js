// Copia de seguridad (exportar/importar) — lógica pura. Un archivo importado es DATO NO CONFIABLE:
// se valida la estructura y se reconstruye copiando solo los campos conocidos y con límites.
import { CATEGORIAS_PROPIAS, GRUPOS, COMPRAS, UNIDADES } from "./propios.js";
import { DIAS, COMIDAS } from "./semana.js";

export const APP = "menu-de-casa";
export const VERSION = 1;
export const AJUSTES_RESPALDO = ["personas", "despensa"];
const MAX = { platos: 500, ingredientes: 500, semanas: 400, ingsPorPlato: 60, texto: 200, notas: 400, ids: 800 };

export function nombreArchivo(fechaISO) { return `menu-de-casa-${String(fechaISO).slice(0, 10)}.json`; }

export function crearRespaldo({ platos = [], ingredientes = [], semanas = [], ajustes = {} }, fechaISO) {
  const aj = {};
  for (const k of AJUSTES_RESPALDO) if (ajustes[k] !== undefined) aj[k] = ajustes[k];
  return { app: APP, version: VERSION, fecha: fechaISO, platos_usuario: platos, ingredientes_usuario: ingredientes, semanas, ajustes: aj };
}

const esTexto = (x) => typeof x === "string";
const corto = (s, n = MAX.texto) => String(s).slice(0, n);
const idsOk = (a) => Array.isArray(a) && a.length <= MAX.ids && a.every((x) => esTexto(x) && x.length <= 60);

function limpiarPlato(p, i, errores) {
  const cat = CATEGORIAS_PROPIAS.find((c) => c.id === p?.categoria);
  if (!p || !esTexto(p.id) || !/^U[a-z0-9]{3,40}$/i.test(p.id)) return errores.push(`Plato ${i + 1}: identificador inválido.`), null;
  if (!esTexto(p.nombre) || p.nombre.trim().length < 2) return errores.push(`Plato ${i + 1}: sin nombre.`), null;
  if (!cat) return errores.push(`Plato “${corto(p.nombre, 40)}”: categoría desconocida.`), null;
  if (!Array.isArray(p.ingredientes) || p.ingredientes.length > MAX.ingsPorPlato) return errores.push(`Plato “${corto(p.nombre, 40)}”: ingredientes inválidos.`), null;
  const ings = [];
  for (const g of p.ingredientes) {
    const alGusto = !!g && g.cant == null;   // básicos "al gusto"
    if (!g || !esTexto(g.id) || g.id.length > 60 || (!alGusto && (!Number.isFinite(g.cant) || g.cant <= 0 || g.cant >= 100000 || !UNIDADES.includes(g.unidad)))) return errores.push(`Plato “${corto(p.nombre, 40)}”: un ingrediente es inválido.`), null;
    ings.push(alGusto ? { id: g.id, cant: null, unidad: null } : { id: g.id, cant: g.cant, unidad: g.unidad });
  }
  const m = p.marcas || {};
  return {
    id: p.id, categoria: cat.id, nombre: corto(p.nombre.trim(), 80), porcion: cat.porcion, base: cat.base, ingredientes: ings,
    notas_ingredientes: esTexto(p.notas_ingredientes) ? corto(p.notas_ingredientes, MAX.notas) : "",
    marcas: {
      harina: Array.isArray(m.harina) ? m.harina.filter((h) => ["a", "f", "p", "h"].includes(h)) : [],
      pescado: ["ninguno", "visible", "camuflado"].includes(m.pescado) ? m.pescado : "ninguno",
      menestra: m.menestra === true, verdura: m.verdura === true, camote: m.camote === true, proteina: "",
    },
    estado: "estimado", nuevo: false, revisar: null, lista_confirmada: false,
  };
}
function limpiarIngrediente(g, i, errores) {
  if (!g || !esTexto(g.id) || !/^x_[a-z0-9_]{1,40}$/.test(g.id)) return errores.push(`Ingrediente ${i + 1}: identificador inválido.`), null;
  if (!esTexto(g.nombre) || g.nombre.trim().length < 2) return errores.push(`Ingrediente ${i + 1}: sin nombre.`), null;
  if (!GRUPOS.includes(g.grupo) || !COMPRAS.some((c) => c.id === g.compra)) return errores.push(`Ingrediente “${corto(g.nombre, 40)}”: grupo o forma de compra inválidos.`), null;
  return { id: g.id, nombre: corto(g.nombre.trim(), 60), grupo: g.grupo, compra: g.compra, basico: false, peso_unidad_g: null, propio: true };
}
function limpiarSemana(s, i, errores) {
  if (!s || !esTexto(s.id) || !/^\d{4}-\d{2}-\d{2}$/.test(s.id) || !s.dias) return errores.push(`Semana ${i + 1}: inválida.`), null;
  const dias = {};
  for (const d of DIAS) {
    const x = s.dias[d];
    if (!x) return errores.push(`Semana ${s.id}: falta el día ${d}.`), null;
    dias[d] = {};
    for (const c of COMIDAS) {
      const y = x[c];
      if (!y || !["platos", "bebidas", "frutas", "acomp"].every((k) => idsOk(y[k]))) return errores.push(`Semana ${s.id}: comida inválida (${d} ${c}).`), null;
      dias[d][c] = { platos: [...y.platos], bebidas: [...y.bebidas], frutas: [...y.frutas], acomp: [...y.acomp] };
      if (esTexto(y.nota)) dias[d][c].nota = corto(y.nota, MAX.notas);
    }
    const ap = x.cena?.apoyo;
    dias[d].cena = { apoyo: esTexto(ap) && ap.length <= 60 ? ap : null };
  }
  const r = { id: s.id, dias };
  if (idsOk(s.comprado)) r.comprado = [...s.comprado];
  if (idsOk(s.basicos_faltan)) r.basicos_faltan = [...s.basicos_faltan];
  return r;
}

// Devuelve { ok, errores, datos: {platos, ingredientes, semanas, ajustes}, resumen }
export function validarRespaldo(obj) {
  const errores = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, errores: ["El archivo no es una copia de seguridad de Menú de casa."] };
  if (obj.app !== APP) return { ok: false, errores: ["El archivo no es una copia de seguridad de Menú de casa."] };
  if (!Number.isInteger(obj.version) || obj.version < 1) return { ok: false, errores: ["La copia no indica su versión."] };
  if (obj.version > VERSION) return { ok: false, errores: ["Esta copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo."] };
  const arr = (x, max, nombre) => { if (x === undefined) return []; if (!Array.isArray(x) || x.length > max) { errores.push(`La lista de ${nombre} no es válida.`); return []; } return x; };
  const platos = arr(obj.platos_usuario, MAX.platos, "platos").map((p, i) => limpiarPlato(p, i, errores)).filter(Boolean);
  const ingredientes = arr(obj.ingredientes_usuario, MAX.ingredientes, "ingredientes").map((g, i) => limpiarIngrediente(g, i, errores)).filter(Boolean);
  const semanas = arr(obj.semanas, MAX.semanas, "semanas").map((s, i) => limpiarSemana(s, i, errores)).filter(Boolean);
  const ajustes = {};
  const a = obj.ajustes || {};
  if (a.personas === 3 || a.personas === 4) ajustes.personas = a.personas;
  if (idsOk(a.despensa)) ajustes.despensa = [...a.despensa];
  // Los ingredientes de los platos propios deben existir (en el catálogo o en esta misma copia)
  return { ok: errores.length === 0, errores, datos: { platos, ingredientes, semanas, ajustes },
    resumen: { platos: platos.length, ingredientes: ingredientes.length, semanas: semanas.length, fecha: esTexto(obj.fecha) ? obj.fecha.slice(0, 10) : "" } };
}

// Ingredientes que usan los platos importados y no existen ni en el catálogo ni en la copia
export function ingredientesFaltantes(datos, idsConocidos) {
  const conocidos = new Set([...idsConocidos, ...datos.ingredientes.map((g) => g.id)]);
  const falta = new Set();
  for (const p of datos.platos) for (const i of p.ingredientes) if (!conocidos.has(i.id)) falta.add(i.id);
  return [...falta];
}
