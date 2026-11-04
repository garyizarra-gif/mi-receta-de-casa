// Pestaña "Semana": armar el menú a mano (o con ayudas opcionales) y ver el resumen.
import { escapar, etiquetas, filtrarPlatos } from "./formato.js";
import * as db from "./db.js";
import {
  DIAS, NOMBRE_DIA, COMIDAS, crearSemana, semanaEstaVacia, copiarSemana, aplicarPlantilla, vaciarSemana, agregar, quitar,
  sugerirRefrescos, resumenSemana, textoComida, etiquetaSemana, semanaPorDefecto, sumarDias,
} from "./semana.js";

const $ = (s) => document.querySelector(s);
const ICONO = { desayuno: "☀️", lonchera: "🎒", almuerzo: "🍽️", cena: "🌙" };
const NOMBRE = { desayuno: "Desayuno", lonchera: "Lonchera", almuerzo: "Almuerzo", cena: "Cena" };
const LUZ = { ok: "🟢", aviso: "🟡", pendiente: "⚪" };

// Qué se puede elegir en cada comida: campo de la comida, título, categoría del catálogo.
const CAMPOS = {
  desayuno: [{ campo: "platos", titulo: "Plato", cat: "desayuno" }, { campo: "bebidas", titulo: "Bebida", cat: "bebida_desayuno" }, { campo: "acomp", titulo: "Acompañamiento", cat: "acompanamiento" }],
  lonchera: [{ campo: "platos", titulo: "Bocado", cat: "lonchera" }, { campo: "frutas", titulo: "Frutas", cat: "fruta_lonchera" }, { campo: "bebidas", titulo: "Refresco", cat: "refresco" }],
  almuerzo: [{ campo: "platos", titulo: "Plato", cat: "almuerzo" }, { campo: "acomp", titulo: "Acompañamiento", cat: "acompanamiento" }, { campo: "bebidas", titulo: "Refresco", cat: "refresco" }],
};

let datos, porId;
const S = { semana: null, ed: null, aviso: "" };

const refrescarIndice = () => { porId = new Map(datos.platos.map((p) => [p.id, p])); };
async function cargar(id) { S.semana = (await db.leer("semanas", id)) || crearSemana(id); }
async function guardar() {
  try { await db.guardar("semanas", S.semana); await db.guardarAjuste("semana_actual", S.semana.id); } catch { /* sigue en memoria */ }
}

export const semanaActual = () => S.semana;
export const guardarSemana = guardar;
export async function recargarSemana() { await cargar(S.semana.id); }
export async function reemplazarSemana(nueva) { S.semana = nueva; await guardar(); }

export async function iniciarSemana(d) {
  datos = d; refrescarIndice();
  let id = null;
  try { id = await db.ajuste("semana_actual", null); } catch { /* usa la de hoy */ }
  await cargar(id || semanaPorDefecto(new Date().toLocaleDateString("en-CA")));
  document.addEventListener("click", onClick);
  document.addEventListener("input", (e) => { if (e.target.id === "q-pick") { S.ed.texto = e.target.value; pintarLista(); } });
}

// ---------- vista principal ----------
export function pintarSemana(v) {
  const res = resumenSemana(S.semana, porId);
  const luces = res.map((r) => `${LUZ[r.estado]} ${escapar(r.titulo)}`).join(" · ");
  v.innerHTML = `
    <div class="sem-barra">
      <button class="sem-nav" data-acc="sem-ant" aria-label="Semana anterior">‹</button>
      <div class="sem-titulo"><small>Semana del</small><strong>${escapar(etiquetaSemana(S.semana.id))}</strong></div>
      <button class="sem-nav" data-acc="sem-sig" aria-label="Semana siguiente">›</button>
      <button class="sem-nav" data-sh="abrir" data-que="menu" aria-label="Compartir el menú">📤</button>
      <button class="sem-mas" data-acc="menu" aria-label="Más opciones">⋯</button>
    </div>
    <details class="resumen">
      <summary><span class="res-luces">${luces}</span></summary>
      <ul>${res.map((r) => `<li class="r-${r.estado}"><span class="luz">${LUZ[r.estado]}</span><div><strong>${escapar(r.titulo)}</strong>${r.mensaje ? `<span>${escapar(r.mensaje)}</span>` : ""}</div></li>`).join("")}</ul>
    </details>
    <div class="dias">${DIAS.map(pintarDia).join("")}</div>`;
}

function pintarDia(d) {
  const dia = S.semana.dias[d];
  const filas = COMIDAS.map((c) => {
    const x = dia[c];
    const t = textoComida(x, porId);
    const lleno = x.platos.length || x.bebidas.length || x.frutas.length || x.acomp.length;
    return `<button class="fila" data-acc="editar" data-dia="${d}" data-com="${c}">
      <span class="et">${ICONO[c]} ${NOMBRE[c]}</span>
      <span class="cont">${lleno ? `<b>${escapar(t.principal || "—")}</b>${t.extra ? `<small>${escapar(t.extra)}</small>` : ""}` : `<span class="vac">+ Elegir</span>`}</span>
    </button>`;
  }).join("");
  const apoyo = dia.cena.apoyo ? porId.get(dia.cena.apoyo) : null;
  return `<article class="dia"><h3>${NOMBRE_DIA[d]}</h3>${filas}
    <button class="fila cena" data-acc="editar" data-dia="${d}" data-com="cena">
      <span class="et">${ICONO.cena} Cena</span>
      <span class="cont"><b>Sobrante del almuerzo</b>${apoyo ? `<small>+ ${escapar(apoyo.nombre)}</small>` : ""}</span>
    </button></article>`;
}

// ---------- editor (hoja emergente) ----------
function abrirEditor() {
  pintarEditor();
  const e = $("#editor");
  if (!e.open) e.showModal();
}
function cerrarEditor() { const e = $("#editor"); if (e.open) e.close(); S.ed = null; }
function repintar() { const v = $("#vista"); if (v && document.querySelector(".sem-barra")) pintarSemana(v); }
const comidaActual = () => S.semana.dias[S.ed.dia][S.ed.com];
const campoActual = () => CAMPOS[S.ed.com].find((c) => c.campo === S.ed.campo);

function pintarEditor() {
  const ed = S.ed, cuerpo = $("#editor-cuerpo");
  if (ed.modo === "menu") return (cuerpo.innerHTML = htmlMenu());
  if (ed.modo === "plantillas") return (cuerpo.innerHTML = htmlPlantillas());
  if (ed.modo === "elegir") return (cuerpo.innerHTML = htmlElegir());
  if (ed.modo === "nuevo") return (cuerpo.innerHTML = htmlNuevo());
  cuerpo.innerHTML = ed.com === "cena" ? htmlCena() : htmlVer();
}

function chips(c, campo) {
  const ids = c[campo];
  if (!ids.length) return `<span class="vac">Nada elegido</span>`;
  return ids.map((id) => `<span class="sel">${escapar(porId.get(id)?.nombre ?? id)}<button data-acc="quitar" data-campo="${campo}" data-id="${escapar(id)}" aria-label="Quitar">✕</button></span>`).join("");
}
function htmlVer() {
  const c = comidaActual();
  const secciones = CAMPOS[S.ed.com].map((f) => `
    <section class="campo"><h3>${f.titulo}</h3><div class="sels">${chips(c, f.campo)}</div>
      <button class="mas" data-acc="agregar" data-campo="${f.campo}">+ Agregar</button></section>`).join("");
  return `<h2>${NOMBRE_DIA[S.ed.dia]} · ${NOMBRE[S.ed.com]}</h2>
    ${c.nota ? `<p class="nota-orig">Según tu menú: “${escapar(c.nota)}”</p>` : ""}
    ${secciones}
    <button class="cerrar" data-acc="cerrar-ed">Listo</button>`;
}
function htmlCena() {
  const apoyo = S.semana.dias[S.ed.dia].cena.apoyo;
  const lic = datos.platos.filter((p) => p.categoria === "licuado_cena");
  return `<h2>${NOMBRE_DIA[S.ed.dia]} · Cena</h2>
    <p class="aviso">La cena es el <strong>sobrante del almuerzo</strong>. Si no alcanza, agrega un licuado de apoyo (entra a las compras solo si lo marcas).</p>
    <ul class="lista">
      <li><button class="plato${!apoyo ? " on" : ""}" data-acc="apoyo" data-id=""><span class="nombre">Solo el sobrante del almuerzo</span></button></li>
      ${lic.map((p) => `<li><button class="plato${apoyo === p.id ? " on" : ""}" data-acc="apoyo" data-id="${escapar(p.id)}"><span class="nombre">${escapar(p.nombre)}</span></button></li>`).join("")}
    </ul>
    <button class="cerrar" data-acc="cerrar-ed">Listo</button>`;
}
function htmlElegir() {
  const f = campoActual();
  const nuevo = f.campo === "platos" ? `<button class="mas" data-acc="nuevo">✍️ Escribir mi propio plato</button>` : "";
  return `<div class="pick-top"><button class="atras" data-acc="atras" aria-label="Volver">‹ Volver</button><h2>${escapar(f.titulo)}</h2></div>
    <div class="buscar"><input id="q-pick" type="search" placeholder="Buscar…" autocomplete="off" value="${escapar(S.ed.texto || "")}" aria-label="Buscar"></div>
    ${nuevo}
    <ul id="lista-pick" class="lista"></ul>`;
}
function pintarLista() {
  const f = campoActual(), el = $("#lista-pick");
  if (!el) return;
  const ya = new Set(comidaActual()[f.campo]);
  const items = filtrarPlatos(datos.platos, { categoria: f.cat, texto: S.ed.texto });
  el.innerHTML = items.length ? items.map((p) => `
    <li><button class="plato${ya.has(p.id) ? " on" : ""}" data-acc="poner" data-id="${escapar(p.id)}">
      <span class="nombre">${ya.has(p.id) ? "✓ " : ""}${escapar(p.nombre)}</span>
      <span class="tags">${etiquetas(p).map((e) => `<span class="tag ${e.clase}">${escapar(e.texto)}</span>`).join("")}</span>
    </button></li>`).join("") : `<li class="sinres">No encontré nada con ese nombre.</li>`;
}
function htmlNuevo() {
  const f = campoActual();
  return `<div class="pick-top"><button class="atras" data-acc="elegir-volver" aria-label="Volver">‹ Volver</button><h2>Mi propio plato</h2></div>
    <label class="etq" for="nuevo-nombre">Nombre del plato</label>
    <input id="nuevo-nombre" class="campo-texto" type="text" maxlength="80" placeholder="Ej. Arroz con leche" autocomplete="off">
    <label class="etq" for="nuevo-ing">Ingredientes (opcional, como nota)</label>
    <textarea id="nuevo-ing" class="campo-texto" rows="3" maxlength="400" placeholder="Ej. arroz, leche, canela"></textarea>
    <p class="aviso">Queda guardado en <strong>Platos</strong> como “tuyo” (${escapar(f.titulo.toLowerCase())}). Sin ingredientes con cantidad, todavía <strong>no suma a las compras</strong>.</p>
    <button class="cerrar" data-acc="guardar-nuevo">Guardar y agregar</button>`;
}
function htmlMenu() {
  return `<h2>Más opciones</h2>
    ${S.aviso ? `<p class="aviso ok">${escapar(S.aviso)}</p>` : ""}
    <div class="menu-lista">
      <button class="plato" data-acc="plantillas"><span class="nombre">📥 Cargar una semana de mis menús</span><small>Punto de partida; luego cambias lo que quieras</small></button>
      <button class="plato" data-acc="repetir"><span class="nombre">🔁 Repetir la semana anterior</span></button>
      <button class="plato" data-acc="refrescos"><span class="nombre">🥤 Sugerir refrescos del almuerzo</span><small>Uno distinto cada día; solo llena los vacíos</small></button>
      <button class="plato" data-acc="vaciar"><span class="nombre">🧹 Vaciar esta semana</span></button>
    </div>
    <button class="cerrar" data-acc="cerrar-ed">Cerrar</button>`;
}
function htmlPlantillas() {
  const lista = datos.plantillas.map((p) => {
    const dias = Object.keys(p.dias);
    const ejemplo = dias.map((d) => porId.get(p.dias[d].almuerzo.platos[0])?.nombre).filter(Boolean).slice(0, 3).join(", ");
    return `<li><button class="plato" data-acc="usar-plantilla" data-id="${escapar(p.id)}"><span class="nombre">${escapar(p.nombre)} · ${dias.length} días</span><small>Almuerzos: ${escapar(ejemplo)}…</small></button></li>`;
  }).join("");
  return `<div class="pick-top"><button class="atras" data-acc="menu" aria-label="Volver">‹ Volver</button><h2>Mis menús</h2></div>
    <p class="aviso">Tomé tus menús de WhatsApp y los traduje a platos del catálogo. Revísalos: lo que no reconocí quedó vacío y puedes completarlo.</p>
    <ul class="lista">${lista}</ul>`;
}

// ---------- acciones ----------
async function cambiarSemana(id) { await cargar(id); await guardar(); repintar(); }
const confirmar = (t) => (S.semana && semanaEstaVacia(S.semana)) || confirm(t);

async function onClick(e) {
  const b = e.target.closest("[data-acc]");
  if (!b || !datos) return;
  const { acc, dia, com, campo, id } = b.dataset;
  const ed = S.ed;
  switch (acc) {
    case "sem-ant": return cambiarSemana(sumarDias(S.semana.id, -7));
    case "sem-sig": return cambiarSemana(sumarDias(S.semana.id, 7));
    case "menu": S.aviso = ""; S.ed = { modo: "menu" }; return abrirEditor();
    case "editar": S.ed = { modo: "ver", dia, com }; return abrirEditor();
    case "agregar": ed.modo = "elegir"; ed.campo = campo; ed.texto = ""; pintarEditor(); pintarLista(); return;
    case "atras": ed.modo = "ver"; return pintarEditor();
    case "elegir-volver": ed.modo = "elegir"; pintarEditor(); pintarLista(); return;
    case "nuevo": ed.modo = "nuevo"; pintarEditor(); return;
    case "poner": agregar(comidaActual(), ed.campo, id); ed.modo = "ver"; await guardar(); pintarEditor(); return repintar();
    case "quitar": quitar(comidaActual(), campo, id); await guardar(); pintarEditor(); return repintar();
    case "apoyo": S.semana.dias[ed.dia].cena.apoyo = id || null; await guardar(); pintarEditor(); return repintar();
    case "cerrar-ed": return cerrarEditor();
    case "guardar-nuevo": return guardarNuevo();
    case "plantillas": ed.modo = "plantillas"; return pintarEditor();
    case "usar-plantilla": {
      const p = datos.plantillas.find((x) => x.id === id);
      if (!p || !confirmar("Esto reemplaza lo que ya armaste en esta semana. ¿Continuar?")) return;
      S.semana = aplicarPlantilla(S.semana, p); await guardar(); S.aviso = `Cargué “${p.nombre}”. Revisa y cambia lo que quieras.`; ed.modo = "menu"; pintarEditor(); return repintar();
    }
    case "repetir": {
      const ant = await db.leer("semanas", sumarDias(S.semana.id, -7));
      if (!ant || semanaEstaVacia(ant)) { S.aviso = "La semana anterior está vacía: no hay nada que repetir."; return pintarEditor(); }
      if (!confirmar("Esto reemplaza lo que ya armaste en esta semana. ¿Continuar?")) return;
      S.semana = copiarSemana(ant, S.semana.id); await guardar(); S.aviso = "Copié la semana anterior."; pintarEditor(); return repintar();
    }
    case "refrescos": S.semana = sugerirRefrescos(S.semana); await guardar(); S.aviso = "Listo: los almuerzos sin refresco ya tienen uno."; pintarEditor(); return repintar();
    case "vaciar":
      if (!confirmar("¿Vaciar toda la semana? No se puede deshacer.")) return;
      S.semana = vaciarSemana(S.semana); await guardar(); S.aviso = "Semana vaciada."; pintarEditor(); return repintar();
  }
}

async function guardarNuevo() {
  const nombre = $("#nuevo-nombre").value.trim();
  if (!nombre) { $("#nuevo-nombre").focus(); return; }
  const f = campoActual();
  const plato = {
    id: "U" + Date.now().toString(36), categoria: f.cat, nombre, porcion: "adulto", base: "por_persona", ingredientes: [],
    notas_ingredientes: $("#nuevo-ing").value.trim(),
    marcas: { harina: [], pescado: "ninguno", menestra: false, verdura: false, camote: false, proteina: "" },
    estado: "estimado", nuevo: false, revisar: null, lista_confirmada: false,
  };
  try { await db.guardar("platos_usuario", plato); } catch { /* queda solo en memoria */ }
  datos.platos.push({ ...plato, origen: "usuario" }); refrescarIndice();
  agregar(comidaActual(), S.ed.campo, plato.id);
  S.ed.modo = "ver"; await guardar(); pintarEditor(); repintar();
}
