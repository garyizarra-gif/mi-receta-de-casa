// Platos propios (crear / editar / duplicar / eliminar), ingredientes propios y copia de seguridad.
import { escapar } from "./formato.js";
import * as db from "./db.js";
import {
  CATEGORIAS_PROPIAS, GRUPOS, COMPRAS, HARINAS, infoCategoria, unidadPorDefecto, parsearCantidad, borradorNuevo, borradorDesde,
  validarBorrador, construirPlato, ingredienteNuevo, semanasQueUsan, quitarPlatoDeSemana,
} from "./propios.js";
import { crearRespaldo, validarRespaldo, nombreArchivo, ingredientesFaltantes } from "./respaldo.js";
import { recargarSemana } from "./vista_semana.js";

const $ = (s) => document.querySelector(s);
let datos, alCambiar = () => {};
const P = { modo: "form", borrador: null, errores: [], q: "", foco: null, aviso: "", pendiente: null, mensaje: "" };

export function iniciarPropios(d, cb) {
  datos = d; alCambiar = cb || alCambiar;
  document.addEventListener("click", onClick);
  document.addEventListener("input", (e) => { if (e.target.id === "q-ing") { P.q = e.target.value; pintarListaIng(); } });
  document.addEventListener("change", (e) => { if (e.target.id === "archivo-respaldo") leerArchivo(e.target.files?.[0]); });
}

const abrir = () => { pintar(); const f = $("#formulario"); if (!f.open) f.showModal(); };
const cerrar = () => { const f = $("#formulario"); if (f.open) f.close(); };

// ---------- render ----------
function pintar() {
  const c = $("#formulario-cuerpo");
  c.innerHTML = { form: htmlForm, "ing-pick": htmlPickIng, "ing-nuevo": htmlIngNuevo, respaldo: htmlRespaldo }[P.modo]();
  if (P.modo === "ing-pick") pintarListaIng();
  if (P.foco != null) { c.querySelectorAll(".cant-in")[P.foco]?.focus(); P.foco = null; }
}
const num = (n) => (n == null ? "" : String(n).replace(".", ","));

function htmlForm() {
  const b = P.borrador, cat = infoCategoria(b.categoria);
  const filas = b.ingredientes.map((i, k) => {
    const ing = datos.ingPorId[i.id];
    return `<div class="ing-fila"><span class="ing-nom">${escapar(ing?.nombre ?? i.id)}</span>
      <input class="cant-in" inputmode="decimal" aria-label="Cantidad de ${escapar(ing?.nombre ?? i.id)}" placeholder="${ing?.basico ? "al gusto" : "cant."}" value="${escapar(i.t ?? num(i.cant))}">
      <select aria-label="Unidad">${["g", "ml", "u"].map((u) => `<option${i.unidad === u ? " selected" : ""}>${u}</option>`).join("")}</select>
      <button class="quitar" data-ap="ing-quitar" data-i="${k}" aria-label="Quitar ${escapar(ing?.nombre ?? i.id)}">✕</button></div>`;
  }).join("");
  const m = b.marcas;
  return `<h2>${b.id ? "Editar plato" : "Nuevo plato"}</h2>
    ${P.aviso ? `<p class="aviso">${escapar(P.aviso)}</p>` : ""}
    <label class="etq" for="f-cat">Categoría</label>
    <select id="f-cat" class="campo-texto">${CATEGORIAS_PROPIAS.map((c) => `<option value="${c.id}"${b.categoria === c.id ? " selected" : ""}>${escapar(c.nombre)}</option>`).join("")}</select>
    <label class="etq" for="f-nombre">Nombre del plato</label>
    <input id="f-nombre" class="campo-texto" type="text" maxlength="80" autocomplete="off" value="${escapar(b.nombre)}">
    <h3 class="sub">Ingredientes <small>(cantidad por ${escapar(cat.porcion)})</small></h3>
    <div class="ing-lista">${filas || `<p class="aviso">Todavía no agregaste ingredientes. Sin ellos el plato no suma a las compras.</p>`}</div>
    <button class="mas" data-ap="ing-agregar">+ Agregar ingrediente</button>
    <h3 class="sub">Para el resumen de la semana <small>(opcional)</small></h3>
    <div class="checks">
      <label><input type="checkbox" id="m-verdura"${m.verdura ? " checked" : ""}> Lleva verdura</label>
      <label><input type="checkbox" id="m-menestra"${m.menestra ? " checked" : ""}> Es menestra</label>
      <label><input type="checkbox" id="m-camote"${m.camote ? " checked" : ""}> Lleva camote</label>
      ${HARINAS.map((h) => `<label><input type="checkbox" name="m-harina" value="${h.id}"${m.harina.includes(h.id) ? " checked" : ""}> ${escapar(h.nombre)}</label>`).join("")}
    </div>
    <label class="etq" for="m-pescado">Pescado</label>
    <select id="m-pescado" class="campo-texto">${[["ninguno", "No lleva"], ["visible", "Sí, se nota"], ["camuflado", "Sí, camuflado"]].map(([v, t]) => `<option value="${v}"${m.pescado === v ? " selected" : ""}>${t}</option>`).join("")}</select>
    <label class="etq" for="f-notas">Notas (opcional)</label>
    <textarea id="f-notas" class="campo-texto" rows="2" maxlength="400">${escapar(b.notas)}</textarea>
    ${P.errores.length ? `<ul class="errores" role="alert">${P.errores.map((e) => `<li>${escapar(e.texto)}</li>`).join("")}</ul>` : ""}
    <button class="cerrar" data-ap="guardar">Guardar plato</button>
    <button class="atras ancho" data-ap="cerrar-form">Cancelar</button>`;
}
function htmlPickIng() {
  return `<div class="pick-top"><button class="atras" data-ap="volver" aria-label="Volver">‹ Volver</button><h2>Ingrediente</h2></div>
    <div class="buscar"><input id="q-ing" type="search" placeholder="Buscar ingrediente…" autocomplete="off" value="${escapar(P.q)}" aria-label="Buscar ingrediente"></div>
    <button class="mas" data-ap="ing-nuevo">+ Crear un ingrediente nuevo</button>
    <ul id="lista-ing" class="lista"></ul>`;
}
function pintarListaIng() {
  const q = P.q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const usados = new Set(P.borrador.ingredientes.map((i) => i.id));
  const items = datos.ingredientes.filter((i) => !q || i.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  $("#lista-ing").innerHTML = items.length ? items.map((i) => `<li><button class="plato${usados.has(i.id) ? " on" : ""}" data-ap="ing-poner" data-id="${escapar(i.id)}">
      <span class="nombre">${usados.has(i.id) ? "✓ " : ""}${escapar(i.nombre)}</span><small>${escapar(i.grupo)}${i.propio ? " · tuyo" : ""}</small></button></li>`).join("")
    : `<li class="sinres">No existe. Puedes crearlo con el botón de arriba.</li>`;
}
function htmlIngNuevo() {
  return `<div class="pick-top"><button class="atras" data-ap="ing-volver" aria-label="Volver">‹ Volver</button><h2>Ingrediente nuevo</h2></div>
    <label class="etq" for="n-nombre">Nombre</label>
    <input id="n-nombre" class="campo-texto" type="text" maxlength="60" autocomplete="off" value="${escapar(P.q)}">
    <label class="etq" for="n-grupo">¿Dónde se compra?</label>
    <select id="n-grupo" class="campo-texto">${GRUPOS.map((g) => `<option>${escapar(g)}</option>`).join("")}</select>
    <label class="etq" for="n-compra">¿Cómo se compra?</label>
    <select id="n-compra" class="campo-texto">${COMPRAS.map((c) => `<option value="${c.id}">${escapar(c.nombre)}</option>`).join("")}</select>
    ${P.mensaje ? `<p class="errores" role="alert">${escapar(P.mensaje)}</p>` : ""}
    <button class="cerrar" data-ap="ing-nuevo-guardar">Crear y agregar</button>`;
}

// ---------- formulario: leer lo escrito antes de cambiar de pantalla ----------
function leerForm() {
  const n = $("#f-nombre");
  if (!n) return;
  const b = P.borrador;
  b.nombre = n.value; b.categoria = $("#f-cat").value; b.notas = $("#f-notas").value;
  b.marcas.verdura = $("#m-verdura").checked; b.marcas.menestra = $("#m-menestra").checked; b.marcas.camote = $("#m-camote").checked;
  b.marcas.pescado = $("#m-pescado").value;
  b.marcas.harina = [...document.querySelectorAll('input[name="m-harina"]:checked')].map((x) => x.value);
  document.querySelectorAll("#formulario .ing-fila").forEach((fila, k) => {
    const t = fila.querySelector(".cant-in").value;
    Object.assign(b.ingredientes[k], { t, cant: parsearCantidad(t), unidad: fila.querySelector("select").value });
  });
}

// ---------- acciones ----------
async function onClick(e) {
  const b = e.target.closest("[data-ap]");
  if (!b || !datos) return;
  const { ap, id, i, catNueva } = b.dataset;
  switch (ap) {
    case "nuevo": P.borrador = borradorNuevo(catNueva && infoCategoria(catNueva) ? catNueva : "almuerzo"); P.modo = "form"; P.errores = []; P.aviso = ""; return abrir();
    case "editar": {
      const p = datos.platos.find((x) => x.id === id); if (!p) return;
      const copia = p.origen !== "usuario";
      P.borrador = borradorDesde(p, { copia }); P.modo = "form"; P.errores = [];
      P.aviso = copia ? "Esto es una copia tuya: el plato original del catálogo no cambia." : "";
      $("#detalle").close(); return abrir();
    }
    case "eliminar": return eliminar(id);
    case "cerrar-form": return cerrar();
    case "ing-agregar": leerForm(); P.modo = "ing-pick"; P.q = ""; return pintar();
    case "volver": P.modo = "form"; return pintar();
    case "ing-quitar": leerForm(); P.borrador.ingredientes.splice(Number(i), 1); return pintar();
    case "ing-poner": {
      const ing = datos.ingPorId[id]; if (!ing) return;
      P.borrador.ingredientes.push({ id, cant: null, unidad: unidadPorDefecto(ing), t: "" });
      P.foco = P.borrador.ingredientes.length - 1; P.modo = "form"; return pintar();
    }
    case "ing-nuevo": P.modo = "ing-nuevo"; P.mensaje = ""; return pintar();
    case "ing-volver": P.modo = "ing-pick"; return pintar();
    case "ing-nuevo-guardar": return crearIngrediente();
    case "guardar": return guardarPlato();
    case "respaldo": P.modo = "respaldo"; P.pendiente = null; P.mensaje = ""; return abrirRespaldo();
    case "exportar": return exportar();
    case "elegir-archivo": return $("#archivo-respaldo")?.click();
    case "restaurar-ok": return restaurar();
    case "restaurar-no": P.pendiente = null; P.mensaje = ""; return pintar();
  }
}

async function guardarPlato() {
  leerForm();
  const v = validarBorrador(P.borrador, datos.ingPorId);
  if (!v.ok) { P.errores = v.errores; pintar(); $("#formulario").scrollTo({ top: 99999 }); return; }
  const plato = construirPlato(P.borrador);
  try { await db.guardar("platos_usuario", plato); } catch { /* queda en memoria */ }
  const k = datos.platos.findIndex((x) => x.id === plato.id);
  const nuevo = { ...plato, origen: "usuario" };
  if (k >= 0) datos.platos[k] = nuevo; else datos.platos.push(nuevo);
  cerrar(); alCambiar();
}

async function crearIngrediente() {
  const r = ingredienteNuevo({ nombre: $("#n-nombre").value, grupo: $("#n-grupo").value, compra: $("#n-compra").value }, new Set(Object.keys(datos.ingPorId)), datos.ingredientes.map((x) => x.nombre));
  if (!r.ok) { P.mensaje = r.error; P.q = $("#n-nombre").value; return pintar(); }
  try { await db.guardar("ingredientes_usuario", r.ing); } catch { /* memoria */ }
  datos.ingredientes.push(r.ing); datos.ingPorId[r.ing.id] = r.ing;
  P.borrador.ingredientes.push({ id: r.ing.id, cant: null, unidad: unidadPorDefecto(r.ing), t: "" });
  P.foco = P.borrador.ingredientes.length - 1; P.modo = "form"; P.mensaje = ""; pintar();
}

async function eliminar(id) {
  const p = datos.platos.find((x) => x.id === id);
  if (!p || p.origen !== "usuario") return;
  let semanas = []; try { semanas = await db.todos("semanas"); } catch { /* */ }
  const usan = semanasQueUsan(semanas, id);
  const aviso = usan.length ? `\n\nEstá en ${usan.length} semana(s) guardada(s); se quitará de ellas.` : "";
  if (!confirm(`¿Eliminar “${p.nombre}”? No se puede deshacer.${aviso}`)) return;
  for (const s of semanas.filter((x) => usan.includes(x.id))) { const r = quitarPlatoDeSemana(s, id); try { await db.guardar("semanas", r.semana); } catch { /* */ } }
  try { await db.borrar("platos_usuario", id); } catch { /* */ }
  datos.platos.splice(datos.platos.findIndex((x) => x.id === id), 1);
  await recargarSemana();
  $("#detalle").close(); alCambiar();
}

// ---------- copia de seguridad ----------
async function resumenActual() {
  const [pl, ing, se] = await Promise.all([db.todos("platos_usuario"), db.todos("ingredientes_usuario"), db.todos("semanas")]);
  const ult = await db.ajuste("ultima_copia", null);
  return { platos: pl.length, ingredientes: ing.length, semanas: se.length, ultima: ult };
}
async function abrirRespaldo() {
  try { P.res = await resumenActual(); } catch { P.res = { platos: 0, ingredientes: 0, semanas: 0, ultima: null }; }
  abrir();
}
function htmlRespaldo() {
  const r = P.res || { platos: 0, ingredientes: 0, semanas: 0, ultima: null };
  if (P.pendiente) {
    const p = P.pendiente;
    return `<h2>Restaurar copia</h2>
      <p>Copia del <strong>${escapar(p.resumen.fecha || "fecha desconocida")}</strong>: ${p.resumen.platos} plato(s) tuyo(s), ${p.resumen.ingredientes} ingrediente(s) tuyo(s), ${p.resumen.semanas} semana(s).</p>
      <p class="aviso">Se <strong>agregan o reemplazan</strong> los que tengan el mismo nombre interno. Lo que ya tienes y no está en la copia se conserva.</p>
      ${p.faltan.length ? `<p class="errores" role="alert">Atención: ${p.faltan.length} ingrediente(s) usados por los platos de la copia no existen aquí; esos platos no sumarán esos ingredientes a las compras.</p>` : ""}
      <button class="cerrar" data-ap="restaurar-ok">Restaurar</button><button class="atras ancho" data-ap="restaurar-no">Cancelar</button>`;
  }
  return `<h2>Copia de seguridad</h2>
    <p class="aviso">Guarda en un archivo tus <strong>platos y ingredientes propios, tus semanas</strong> y tus ajustes (personas y “ya tengo en casa”). Sirve para no perder nada si cambias de teléfono o borras los datos del navegador.</p>
    <p>Ahora tienes: <strong>${r.platos}</strong> plato(s) tuyo(s), <strong>${r.ingredientes}</strong> ingrediente(s) tuyo(s) y <strong>${r.semanas}</strong> semana(s) guardada(s).<br>
      <small>${r.ultima ? `Última copia: ${escapar(r.ultima)}` : "Todavía no has guardado ninguna copia."}</small></p>
    <button class="cerrar" data-ap="exportar">⬇ Guardar copia en el teléfono</button>
    <h3 class="sub">Restaurar</h3>
    <button class="mas" data-ap="elegir-archivo">📂 Restaurar desde un archivo</button>
    <input type="file" id="archivo-respaldo" accept="application/json,.json" hidden>
    ${P.mensaje ? `<p class="${P.ok ? "aviso ok" : "errores"}" role="alert">${escapar(P.mensaje)}</p>` : ""}
    <button class="atras ancho" data-ap="cerrar-form">Cerrar</button>`;
}

async function exportar() {
  const [platos, ingredientes, semanas] = await Promise.all([db.todos("platos_usuario"), db.todos("ingredientes_usuario"), db.todos("semanas")]);
  const ajustes = { personas: await db.ajuste("personas", 4), despensa: await db.ajuste("despensa", []) };
  const ahora = new Date().toLocaleDateString("en-CA");   // fecha LOCAL (YYYY-MM-DD); toISOString daría la de UTC, que de noche en Perú ya es mañana
  const json = JSON.stringify(crearRespaldo({ platos, ingredientes, semanas, ajustes }, ahora), null, 1);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombreArchivo(ahora); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  try { await db.guardarAjuste("ultima_copia", ahora); } catch { /* */ }
  P.ok = true; P.mensaje = `Listo: se guardó “${nombreArchivo(ahora)}” en las descargas de tu teléfono.`;
  await abrirRespaldo();
}

async function leerArchivo(archivo) {
  if (!archivo) return;
  P.ok = false;
  if (archivo.size > 5 * 1024 * 1024) { P.mensaje = "El archivo es demasiado grande para ser una copia de Menú de casa."; return pintar(); }
  let obj;
  try { obj = JSON.parse(await archivo.text()); } catch { P.mensaje = "No pude leer el archivo: no es una copia válida."; return pintar(); }
  const v = validarRespaldo(obj);
  if (!v.ok) { P.mensaje = v.errores.slice(0, 3).join(" "); return pintar(); }
  P.pendiente = { datos: v.datos, resumen: v.resumen, faltan: ingredientesFaltantes(v.datos, Object.keys(datos.ingPorId)) };
  P.mensaje = ""; pintar();
}

async function restaurar() {
  const d = P.pendiente?.datos;
  if (!d) return;
  for (const g of d.ingredientes) await db.guardar("ingredientes_usuario", g);
  for (const p of d.platos) await db.guardar("platos_usuario", p);
  for (const s of d.semanas) await db.guardar("semanas", s);
  if (d.ajustes.personas) await db.guardarAjuste("personas", d.ajustes.personas);
  if (d.ajustes.despensa) await db.guardarAjuste("despensa", d.ajustes.despensa);
  location.reload();   // vuelve a cargar todo con lo restaurado
}
