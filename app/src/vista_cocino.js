// Pestaña "¿Qué cocino?": marcar lo que hay en casa (a mano o por foto) y ver qué platos se pueden cocinar.
// La foto se reduce aquí (≈300 KB) y se manda al servicio intermediario; la clave de Claude NUNCA está en la app.
import { escapar, etiquetas, normalizar } from "./formato.js";
import { CATEGORIAS_COCINAR, MAX_FOTOS, coincidencias, separar, catalogoParaFoto, normalizarUrl, interpretarRespuesta, mensajeError, pareceClaveApi } from "./cocinar.js";
import { MIN_INSUMOS_MENU, solicitudMenu, menuDesdeIA, limpiarMenu, menuVacio, menuLocal, idsPlatosDelMenu, faltantesMenu, avisosMenu, aplicarMenuADia, diaTieneComidas, textoDeComidaMenu, DIAS } from "./menu_dia.js";
import { NOMBRE_DIA, etiquetaSemana } from "./semana.js";
import { semanaActual, reemplazarSemana } from "./vista_semana.js";
import { personasActuales } from "./vista_compras.js";
import * as db from "./db.js";

const $ = (s) => document.querySelector(s);
let datos;
const K = {
  tengo: new Set(), despensa: [], usarDespensa: true, fotos: [], cat: "almuerzo", enviando: false, msg: "", ok: true, otros: [],
  url: "", token: "", cfgAbierto: false, q: "", msgCfg: "", okCfg: true,
  menu: null, modoMenu: "ia", evitar: new Set(), diaSel: "lunes", msgMenu: "", okMenu: true, cargandoMenu: false,
};

export async function iniciarCocino(d) {
  datos = d;
  try {
    const t = await db.ajuste("tengo_hoy", []);
    K.tengo = new Set(t.filter((id) => datos.ingPorId[id]));
    K.usarDespensa = await db.ajuste("cocino_despensa", true);
    K.url = await db.ajuste("foto_url", ""); K.token = await db.ajuste("foto_token", "");
    K.despensa = await db.ajuste("despensa", []);
  } catch { /* valores por defecto */ }
  const hoy = new Date().getDay(); if (hoy >= 1 && hoy <= 5) K.diaSel = DIAS[hoy - 1];
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  document.addEventListener("toggle", (e) => { if (e.target.id === "ck-cfg") K.cfgAbierto = e.target.open; }, true);
}

const nombreIng = (id) => (datos.ingPorId[id]?.nombre ?? id).replace(/\s*\(.*\)\s*$/, "");
const tengoTodo = () => new Set([...K.tengo, ...(K.usarDespensa ? K.despensa.filter((id) => datos.ingPorId[id]) : [])]);
const guardarTengo = () => { K.menu = null; K.evitar.clear(); K.msgMenu = ""; return db.guardarAjuste("tengo_hoy", [...K.tengo]).catch(() => {}); };   // cambian los insumos: el menú anterior ya no vale
const repintar = () => { const v = $("#vista"); if (v && document.querySelector(".cocino")) pintarCocino(v); };

export function pintarCocino(v) {
  v.innerHTML = htmlCocino(K.cfgAbierto);   // K.cfgAbierto se mantiene al día con el evento "toggle"; así se puede abrir por código
  db.ajuste("despensa", []).then((d) => { if (JSON.stringify(d) !== JSON.stringify(K.despensa)) { K.despensa = d; if (K.usarDespensa) repintarSinPerder(); } }).catch(() => {});
}
function repintarSinPerder() { const v = $("#vista"); if (v && document.querySelector(".cocino") && document.activeElement?.tagName !== "INPUT") v.innerHTML = htmlCocino(K.cfgAbierto); }

function htmlCocino(cfgAbierto) {
  const chips = [...K.tengo].map((id) => `<span class="sel">${escapar(nombreIng(id))}<button data-ck="quitar" data-id="${escapar(id)}" aria-label="Quitar ${escapar(nombreIng(id))}">✕</button></span>`).join("");
  const nDesp = K.despensa.filter((id) => datos.ingPorId[id]).length;
  const fotos = K.fotos.map((f, i) => `<div class="ck-foto"><img src="${f.miniatura}" alt="Foto ${i + 1}"><button data-ck="quitar-foto" data-i="${i}" aria-label="Quitar foto ${i + 1}">✕</button></div>`).join("");
  return `<section class="cocino">
    <h2>¿Qué cocino?</h2>
    <p class="aviso">Dime qué tienes en casa —con una foto o marcándolo a mano— y te armo un menú del día y te muestro qué platos puedes cocinar. El aceite, la sal y el ajo se dan por hechos.</p>

    <h3 class="sub">Lo que tengo <small>(${K.tengo.size})</small></h3>
    <div class="sels">${chips || `<span class="vac">Todavía no marcaste nada</span>`}</div>
    <div class="ck-acc"><button class="mas" data-ck="agregar">+ Agregar a mano</button>${K.tengo.size ? `<button class="mas sec" data-ck="limpiar">Borrar todo</button>` : ""}</div>
    ${nDesp ? `<label class="ck-check"><input type="checkbox" data-ck="despensa"${K.usarDespensa ? " checked" : ""}> Contar también lo que marqué como “ya tengo en casa” (${nDesp})</label>` : ""}

    <h3 class="sub">Reconocer por foto</h3>
    <input type="file" id="ck-archivo" accept="image/*" multiple hidden>
    <button class="mas" data-ck="foto"${K.fotos.length >= MAX_FOTOS ? " disabled" : ""}>📷 Tomar o elegir foto <small>(hasta ${MAX_FOTOS})</small></button>
    ${fotos ? `<div class="ck-fotos">${fotos}</div>` : ""}
    ${K.fotos.length ? `<button class="cerrar" data-ck="reconocer"${K.enviando ? " disabled" : ""}>${K.enviando ? "Analizando…" : "🔍 Reconocer insumos"}</button>` : ""}
    <p id="ck-msg" class="aviso ${K.ok ? (K.msg ? "ok" : "") : "ten"}" role="status">${escapar(K.msg)}</p>
    ${K.otros.length ? `<p class="aviso">Vi también, pero no está en tu lista de ingredientes: <strong>${K.otros.map(escapar).join(", ")}</strong>. Puedes agregarlos a mano si existen.</p>` : ""}
    <p class="aviso">La foto la analiza Claude a través de tu servicio privado; no se guarda. Revisa siempre lo detectado: puede equivocarse.</p>

    ${htmlMenuDia()}

    ${htmlResultados()}

    <details class="extra" id="ck-cfg"${cfgAbierto ? " open" : ""}><summary>Conexión del servicio de fotos</summary>
      <label class="etq" for="ck-url">Dirección del servicio</label>
      <input id="ck-url" class="campo-texto" type="url" inputmode="url" autocomplete="off" placeholder="https://menu-de-casa-fotos.TU-USUARIO.workers.dev" value="${escapar(K.url)}">
      <label class="etq" for="ck-token">Código de acceso <small>(lo inventas tú)</small></label>
      <input id="ck-token" class="campo-texto" type="password" autocomplete="off" value="${escapar(K.token)}" aria-describedby="ck-ayuda-token">
      <p id="ck-ayuda-token" class="aviso">Es una contraseña que <strong>tú inventas</strong> para tu servicio de fotos. <strong>No es tu clave de API</strong> de Anthropic (esa empieza con <code>sk-</code> y nunca se pega en la app).</p>
      <div class="ck-acc"><button class="mas" data-ck="cfg-guardar">Guardar</button><button class="mas sec" data-ck="cfg-probar">Probar conexión</button></div>
      <p id="ck-msg-cfg" class="aviso ${K.okCfg ? (K.msgCfg ? "ok" : "") : "ten"}" role="status">${escapar(K.msgCfg)}</p>
    </details>
  </section>`;
}

function htmlResultados() {
  const tab = `<div class="chips" role="group" aria-label="Tipo de comida">${CATEGORIAS_COCINAR.map((c) => `<button class="chip${K.cat === c.id ? " on" : ""}" data-ck="cat" data-v="${c.id}" aria-pressed="${K.cat === c.id}">${escapar(c.nombre)}</button>`).join("")}</div>`;
  if (!tengoTodo().size) return `<h3 class="sub">Qué puedes cocinar</h3>${tab}<p class="aviso">Marca lo que tienes en casa y aquí aparecerán las ideas.</p>`;
  const { listos, casi } = separar(coincidencias(datos.platos, tengoTodo(), datos.ingPorId, { categoria: K.cat }));
  const tarjeta = (r) => `<li><button class="plato" data-id="${escapar(r.plato.id)}"><span class="nombre">${escapar(r.plato.nombre)}</span>
      <span class="tags">${etiquetas(r.plato).map((e) => `<span class="tag ${e.clase}">${escapar(e.texto)}</span>`).join("")}</span>
      ${r.faltan.length ? `<small class="falta">Te falta: ${r.faltan.map((id) => escapar(nombreIng(id))).join(", ")}</small>` : `<small class="listo">¡Tienes todo!</small>`}</button></li>`;
  return `<h3 class="sub">Qué puedes cocinar</h3>${tab}
    <h4 class="ck-tit">✅ Puedes cocinar ya <small>(${listos.length})</small></h4>
    ${listos.length ? `<ul class="lista">${listos.map(tarjeta).join("")}</ul>` : `<p class="aviso">Con lo que marcaste no sale ningún plato completo de esta categoría.</p>`}
    <h4 class="ck-tit">🟡 Te falta poco <small>(${casi.length})</small></h4>
    ${casi.length ? `<ul class="lista">${casi.slice(0, 30).map(tarjeta).join("")}</ul>` : `<p class="aviso">Ningún plato está a 1 o 2 ingredientes.</p>`}`;
}

// ---------- selector manual ----------
function abrirSelector() { K.q = ""; pintarSelector(); const d = $("#cocino-dlg"); if (!d.open) d.showModal(); }
function pintarSelector() {
  const c = $("#cocino-dlg-cuerpo");
  const q = normalizar(K.q);
  const items = datos.ingredientes.filter((i) => !i.basico && (!q || normalizar(i.nombre).includes(q))).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  c.innerHTML = `<div class="pick-top"><h2>Lo que tengo</h2></div>
    <div class="buscar"><input id="ck-q" type="search" placeholder="Buscar ingrediente…" autocomplete="off" value="${escapar(K.q)}" aria-label="Buscar ingrediente"></div>
    <ul class="lista ck-lista">${items.map((i) => `<li><button class="plato${K.tengo.has(i.id) ? " on" : ""}" data-ck="alternar" data-id="${escapar(i.id)}"><span class="nombre">${K.tengo.has(i.id) ? "✓ " : ""}${escapar(i.nombre)}</span><small>${escapar(i.grupo)}</small></button></li>`).join("") || `<li class="sinres">No encontré ese ingrediente.</li>`}</ul>
    <button class="cerrar" data-ck="listo">Listo (${K.tengo.size})</button>`;
}

// ---------- fotos ----------
async function aJpeg(archivo, maxLado = 1280, calidad = 0.82) {
  let fuente;
  if (window.createImageBitmap) fuente = await createImageBitmap(archivo);
  else fuente = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(archivo); });
  const esc = Math.min(1, maxLado / Math.max(fuente.width, fuente.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(fuente.width * esc)); c.height = Math.max(1, Math.round(fuente.height * esc));
  c.getContext("2d").drawImage(fuente, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", calidad));
  if (!blob) throw new Error("no se pudo procesar");
  const data = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1]); f.onerror = rej; f.readAsDataURL(blob); });
  return { media_type: "image/jpeg", data, miniatura: URL.createObjectURL(blob), bytes: blob.size };
}
async function agregarFotos(lista) {
  const cupo = MAX_FOTOS - K.fotos.length;
  const archivos = [...lista].filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, cupo));
  if (!archivos.length) { K.ok = false; K.msg = "Elige una foto (imagen)."; return repintar(); }
  try { for (const a of archivos) K.fotos.push(await aJpeg(a)); K.msg = ""; K.ok = true; }
  catch { K.ok = false; K.msg = "No pude leer esa foto. Prueba con otra."; }
  repintar();
}

// Una clave de API pegada por error se borra de la memoria y NO se guarda ni se envía a ninguna parte.
function bloquearClave() {
  if (!pareceClaveApi(K.token)) return false;
  K.token = ""; K.okCfg = false; K.msgCfg = mensajeError("clave_en_codigo"); K.cfgAbierto = true; repintar();
  return true;
}
async function reconocer() {
  if (bloquearClave()) return;
  const cfg = normalizarUrl(K.url);
  if (!cfg.ok || !K.token) { K.ok = false; K.msg = mensajeError("sin_configurar"); K.cfgAbierto = true; return repintar(); }
  K.enviando = true; K.ok = true; K.msg = "Analizando la foto… puede tardar unos segundos."; K.otros = []; repintar();
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 70000);
  try {
    const r = await fetch(`${cfg.url}/analizar`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Menu-Token": K.token }, signal: ctrl.signal,
      body: JSON.stringify({ imagenes: K.fotos.map((f) => ({ media_type: f.media_type, data: f.data })), catalogo: catalogoParaFoto(datos.ingredientes) }),
    });
    let d = null; try { d = await r.json(); } catch { /* sin cuerpo */ }
    if (!r.ok || !d?.ok) { K.ok = false; K.msg = mensajeError(r.status === 401 ? "no_autorizado" : d?.error, d || {}); }
    else {
      const { ids, otros } = interpretarRespuesta(d, datos.ingPorId);
      const nuevos = ids.filter((id) => !K.tengo.has(id)).length;
      ids.forEach((id) => K.tengo.add(id)); K.otros = otros; guardarTengo();
      K.ok = true; K.msg = ids.length ? `Encontré ${ids.length} insumo(s) (${nuevos} nuevo(s)). Revisa la lista: quita lo que no sea o agrega lo que falte.` : "No reconocí insumos en la foto. Prueba con otra más cerca o marca a mano.";
    }
  } catch (e) { K.ok = false; K.msg = e?.name === "AbortError" ? "Tardó demasiado. Inténtalo otra vez." : mensajeError("sin_conexion"); }
  finally { clearTimeout(t); K.enviando = false; repintar(); }
}

async function guardarCfg() {
  if (bloquearClave()) return;
  const n = normalizarUrl(K.url);
  if (!n.ok) { K.okCfg = false; K.msgCfg = n.error; return repintar(); }
  if (!K.token.trim()) { K.okCfg = false; K.msgCfg = "Escribe el código de acceso."; return repintar(); }
  K.url = n.url; K.token = K.token.trim();
  try { await db.guardarAjuste("foto_url", K.url); await db.guardarAjuste("foto_token", K.token); } catch { /* memoria */ }
  K.okCfg = true; K.msgCfg = "Guardado en este teléfono."; repintar();
}
async function probarCfg() {
  if (bloquearClave()) return;
  const n = normalizarUrl(K.url);
  if (!n.ok || !K.token.trim()) { K.okCfg = false; K.msgCfg = mensajeError("sin_configurar"); return repintar(); }
  K.msgCfg = "Probando…"; K.okCfg = true; repintar();
  try {
    const r = await fetch(`${n.url}/salud`, { headers: { "X-Menu-Token": K.token.trim() } });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok) { K.okCfg = true; K.msgCfg = `Conectado ✓ Modelo: ${d.modelo}. Gastado este mes: $${Number(d.gastado_mes_usd).toFixed(2)} de $${Number(d.tope_mes_usd).toFixed(2)}.`; }
    else { K.okCfg = false; K.msgCfg = mensajeError(r.status === 401 ? "no_autorizado" : d?.error, d || {}); }
  } catch { K.okCfg = false; K.msgCfg = mensajeError("sin_conexion"); }
  repintar();
}

// ---------- menú del día ----------
function htmlMenuDia() {
  const n = tengoTodo().size, m = K.menu;
  const bloqueado = n < MIN_INSUMOS_MENU || K.cargandoMenu;
  let h = `<h3 class="sub">Menú del día</h3>
    <p class="aviso">Con lo que tienes, te armo un posible menú de desayuno, lonchera y almuerzo. La cena es el sobrante del almuerzo.</p>
    <div class="ck-acc">
      <button class="cerrar ck-menu-btn" data-ck="menu-ia"${bloqueado ? " disabled" : ""}>${K.cargandoMenu && K.modoMenu === "ia" ? "Pensando el menú…" : "🤖 Armar menú con IA"}</button>
      <button class="mas sec ck-menu-btn" data-ck="menu-local"${n < MIN_INSUMOS_MENU ? " disabled" : ""}>🧩 Sin IA (más simple)</button>
    </div>
    ${n < MIN_INSUMOS_MENU ? `<p class="aviso">Marca al menos ${MIN_INSUMOS_MENU} insumos para armar un menú.</p>` : ""}
    <p id="ck-msg-menu" class="aviso ${K.okMenu ? (K.msgMenu ? "ok" : "") : "ten"}" role="status">${escapar(K.msgMenu)}</p>`;
  if (m && !menuVacio(m)) h += tarjetaMenu(m);
  return h;
}

function tarjetaMenu(m) {
  const porId = new Map(datos.platos.map((p) => [p.id, p]));
  const fila = (clave, icono, nombre) => {
    const c = m[clave];
    if (!c.platos.length && !(c.bebidas || []).length) return "";
    const t = textoDeComidaMenu(c, porId);
    const abre = c.platos[0] ? ` data-id="${escapar(c.platos[0])}"` : "";
    return `<button class="mn-fila"${abre}${abre ? "" : " disabled"}><span class="et">${icono} ${nombre}</span><span class="cont"><b>${escapar(t.principal || "—")}</b>${t.extra ? `<small>${escapar(t.extra)}</small>` : ""}</span></button>`;
  };
  const falta = faltantesMenu(m, porId, tengoTodo(), datos.ingPorId);
  const avisos = avisosMenu(m, porId);
  const dias = DIAS.map((d) => `<button class="chip${K.diaSel === d ? " on" : ""}" data-ck="dia" data-v="${d}" aria-pressed="${K.diaSel === d}">${NOMBRE_DIA[d].slice(0, 3)}</button>`).join("");
  return `<article class="mn-card" aria-label="Menú sugerido">
      <p class="mn-origen">${m.origen === "ia" ? "✨ Menú sugerido por IA" : "🧩 Menú sencillo (sin IA)"}</p>
      ${fila("desayuno", "☀️", "Desayuno")}${fila("lonchera", "🎒", "Lonchera")}${fila("almuerzo", "🍽️", "Almuerzo")}
      <div class="mn-fila fija"><span class="et">🌙 Cena</span><span class="cont"><b>Sobrante del almuerzo</b></span></div>
      ${m.explicacion ? `<p class="mn-expl">${escapar(m.explicacion)}</p>` : ""}
      ${avisos.map((a) => `<p class="aviso ten">${escapar(a)}</p>`).join("")}
      <p class="mn-falta">${falta.length ? `<strong>Te faltaría comprar:</strong> ${falta.map((f) => escapar(f.nombre)).join(", ")}` : "✅ <strong>No te falta nada</strong> para este menú."}</p>
      ${m.ideas?.length ? `<p class="mn-ideas"><strong>Ideas extra:</strong> ${m.ideas.map(escapar).join(" · ")}</p>` : ""}
      <div class="ck-acc"><button class="mas" data-ck="menu-otro">🔄 Otro menú</button></div>
      <p class="mn-poner">Ponerlo en mi semana, el día:</p>
      <div class="chips" role="group" aria-label="Día de la semana">${dias}</div>
      <button class="cerrar" data-ck="poner-semana">📅 Poner en mi semana</button>
    </article>`;
}

function terminaMenu(m, ia) {
  const porId = new Map(datos.platos.map((p) => [p.id, p]));
  const limpio = limpiarMenu(m, porId);
  if (menuVacio(limpio)) {
    K.menu = null; K.okMenu = false;
    K.msgMenu = ia ? "La IA no encontró un menú que encaje con lo que tienes. Prueba con “Sin IA” o agrega más insumos." : "Con lo que marcaste no encontré platos para armar un menú. Agrega más insumos.";
    return;
  }
  limpio.origen = m.origen;
  K.menu = limpio; K.okMenu = true;
  idsPlatosDelMenu(limpio).forEach((id) => K.evitar.add(id));
  K.msgMenu = ia ? "Listo. Revísalo: es una sugerencia, tú decides." : "Listo. Este menú se armó sin IA, con una regla sencilla.";
}

async function menuConIA() {
  if (bloquearClave()) return;
  const cfg = normalizarUrl(K.url);
  if (!cfg.ok || !K.token) { K.okMenu = false; K.msgMenu = mensajeError("sin_configurar") + " O usa “Sin IA”."; K.cfgAbierto = true; return repintar(); }
  K.modoMenu = "ia"; K.cargandoMenu = true; K.okMenu = true; K.msgMenu = "Pensando el menú… puede tardar unos segundos."; repintar();
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 70000);
  try {
    const cuerpo = solicitudMenu({ platos: datos.platos, tengo: tengoTodo(), ingPorId: datos.ingPorId, personas: personasActuales(), evitar: K.evitar });
    const r = await fetch(`${cfg.url}/menu`, { method: "POST", headers: { "Content-Type": "application/json", "X-Menu-Token": K.token }, body: JSON.stringify(cuerpo), signal: ctrl.signal });
    let d = null; try { d = await r.json(); } catch { /* sin cuerpo */ }
    if (!r.ok || !d?.ok) { K.okMenu = false; K.msgMenu = mensajeError(r.status === 401 ? "no_autorizado" : d?.error, d || {}) + " Puedes probar “Sin IA”."; }
    else terminaMenu(menuDesdeIA(d), true);
  } catch (e) { K.okMenu = false; K.msgMenu = (e?.name === "AbortError" ? "Tardó demasiado." : mensajeError("sin_conexion")) + " Puedes probar “Sin IA”."; }
  finally { clearTimeout(t); K.cargandoMenu = false; repintar(); }
}
function menuSinIA() {
  K.modoMenu = "local";
  const porId = new Map(datos.platos.map((p) => [p.id, p]));
  let m = menuLocal(datos.platos, tengoTodo(), datos.ingPorId, { evitar: K.evitar, porId });
  if (menuVacio(m) && K.evitar.size) { K.evitar.clear(); m = menuLocal(datos.platos, tengoTodo(), datos.ingPorId, { porId }); }   // ya se mostraron todas las combinaciones: se vuelve a empezar
  terminaMenu(m, false); repintar();
}
async function ponerEnSemana() {
  if (!K.menu) return;
  const s = semanaActual();
  if (diaTieneComidas(s, K.diaSel) && !confirm(`El ${NOMBRE_DIA[K.diaSel].toLowerCase()} ya tiene comidas. ¿Reemplazarlas por este menú?`)) return;
  await reemplazarSemana(aplicarMenuADia(s, K.diaSel, K.menu));
  K.okMenu = true; K.msgMenu = `Listo: puse el menú en el ${NOMBRE_DIA[K.diaSel].toLowerCase()} de la semana del ${etiquetaSemana(s.id)}. Míralo en la pestaña Semana.`; repintar();
}

// ---------- eventos ----------
function onInput(e) {
  if (e.target.id === "ck-q") { K.q = e.target.value; pintarSelector(); const q = $("#ck-q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  if (e.target.id === "ck-url") K.url = e.target.value;
  if (e.target.id === "ck-token") K.token = e.target.value;
}
function onChange(e) {
  if (e.target.id === "ck-archivo") { agregarFotos(e.target.files || []); e.target.value = ""; }
  if (e.target.matches?.('input[data-ck="despensa"]')) { K.usarDespensa = e.target.checked; db.guardarAjuste("cocino_despensa", K.usarDespensa).catch(() => {}); repintar(); }
}
async function onClick(e) {
  const b = e.target.closest("button[data-ck]");
  if (!b || !datos) return;
  const { ck, id, i, v } = b.dataset;
  switch (ck) {
    case "agregar": return abrirSelector();
    case "alternar": K.tengo.has(id) ? K.tengo.delete(id) : K.tengo.add(id); guardarTengo(); return pintarSelector();
    case "listo": $("#cocino-dlg").close(); return repintar();
    case "quitar": K.tengo.delete(id); guardarTengo(); return repintar();
    case "limpiar": K.tengo.clear(); K.otros = []; guardarTengo(); return repintar();
    case "foto": return $("#ck-archivo")?.click();
    case "quitar-foto": { const f = K.fotos.splice(Number(i), 1)[0]; if (f) URL.revokeObjectURL(f.miniatura); return repintar(); }
    case "reconocer": return reconocer();
    case "cat": K.cat = v; return repintar();
    case "cfg-guardar": return guardarCfg();
    case "cfg-probar": return probarCfg();
    case "menu-ia": return menuConIA();
    case "menu-local": return menuSinIA();
    case "menu-otro": return K.modoMenu === "ia" ? menuConIA() : menuSinIA();
    case "dia": K.diaSel = v; return repintar();
    case "poner-semana": return ponerEnSemana();
  }
}
