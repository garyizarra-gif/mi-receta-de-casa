// Cuadro "Compartir": copiar texto, abrir WhatsApp o sacar el PDF (impresión del navegador → "Guardar como PDF").
import { textoSemana, textoCompras, detalleDia, textoDia, urlWhatsApp, htmlMenu, htmlCompras, htmlDia } from "./compartir.js";
import { semanaActual } from "./vista_semana.js";
import { resultadoCompras, personasActuales } from "./vista_compras.js";
import { DIAS, NOMBRE_DIA, etiquetaSemana } from "./semana.js";
import { escapar } from "./formato.js";

const $ = (s) => document.querySelector(s);
const QUE = [{ id: "menu", nombre: "Menú de la semana" }, { id: "compras", nombre: "Lista de compras" }, { id: "dia", nombre: "Hoja del día" }];
const CORTO = { lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie" };
let datos, tituloOriginal = null;
const H = { que: "menu", dia: "lunes", msg: "", ok: true };

export function iniciarCompartir(d) {
  datos = d;
  document.addEventListener("click", onClick);
  window.addEventListener("afterprint", limpiarImpresion);
}

// Todo lo que se comparte sale de una sola función, para que texto, WhatsApp y PDF digan lo mismo.
function contenido() {
  const s = semanaActual(), p = personasActuales(), porId = new Map(datos.platos.map((x) => [x.id, x]));
  if (H.que === "menu") return { texto: textoSemana(s, porId, p), html: htmlMenu(s, porId, p), titulo: `Menú de casa - Menú ${etiquetaSemana(s.id)}` };
  if (H.que === "compras") { const r = resultadoCompras(); return { texto: textoCompras(r, s, p), html: htmlCompras(r, s, p), titulo: `Menú de casa - Compras ${etiquetaSemana(s.id)}` }; }
  const det = detalleDia(s, H.dia, porId, datos.ingPorId, p);
  return { texto: textoDia(det), html: htmlDia(det), titulo: `Menú de casa - ${det.titulo}` };
}

function pintar() {
  const c = contenido();
  $("#compartir-cuerpo").innerHTML = `
    <h2>Compartir</h2>
    <div class="chips sh-chips" role="group" aria-label="Qué compartir">${QUE.map((q) => `<button class="chip${H.que === q.id ? " on" : ""}" data-sh="que" data-v="${q.id}" aria-pressed="${H.que === q.id}">${q.nombre}</button>`).join("")}</div>
    ${H.que === "dia" ? `<div class="chips sh-chips" role="group" aria-label="Día">${DIAS.map((d) => `<button class="chip${H.dia === d ? " on" : ""}" data-sh="dia" data-v="${d}" aria-pressed="${H.dia === d}" title="${NOMBRE_DIA[d]}">${CORTO[d]}</button>`).join("")}</div>` : ""}
    <p class="aviso">Para <strong>${personasActuales()} personas</strong> (se cambia en Compras). Así se verá el mensaje:</p>
    <textarea id="sh-texto" class="campo-texto" rows="11" readonly aria-label="Texto a compartir">${escapar(c.texto)}</textarea>
    <div class="sh-acciones">
      <button class="btn-sh" data-sh="copiar">📋 Copiar texto</button>
      <button class="btn-sh" data-sh="whatsapp">💬 WhatsApp</button>
      <button class="btn-sh" data-sh="pdf">📄 PDF</button>
    </div>
    <p id="sh-msg" class="aviso ${H.ok ? "ok" : "ten"}" role="status">${escapar(H.msg)}</p>
    <p class="aviso"><strong>PDF:</strong> se abre la impresión; elige <em>“Guardar como PDF”</em>. Luego puedes enviar el archivo por WhatsApp.</p>
    <button class="atras ancho" data-sh="cerrar">Cerrar</button>`;
}
const abrir = () => { pintar(); const d = $("#compartir"); if (!d.open) d.showModal(); };

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso o sin https: probamos el método antiguo */ }
  try { const t = $("#sh-texto"); t.removeAttribute("readonly"); t.select(); t.setSelectionRange(0, 999999); const ok = document.execCommand("copy"); t.setAttribute("readonly", ""); return ok; } catch { return false; }
}

function imprimir() {
  const c = contenido();
  $("#impresion").innerHTML = c.html;
  if (tituloOriginal === null) tituloOriginal = document.title;
  document.title = c.titulo;      // el navegador lo propone como nombre del archivo PDF
  window.print();
}
function limpiarImpresion() {
  const i = $("#impresion"); if (i) i.innerHTML = "";
  if (tituloOriginal !== null) { document.title = tituloOriginal; tituloOriginal = null; }
}

async function onClick(e) {
  const b = e.target.closest("[data-sh]");
  if (!b || !datos) return;
  const { sh, v, que } = b.dataset;
  switch (sh) {
    case "abrir": H.que = que || "menu"; H.msg = ""; return abrir();
    case "que": H.que = v; H.msg = ""; return pintar();
    case "dia": H.dia = v; H.msg = ""; return pintar();
    case "cerrar": return $("#compartir").close();
    case "copiar": { const ok = await copiar(contenido().texto); H.ok = ok; H.msg = ok ? "Copiado. Ahora pégalo en WhatsApp." : "No pude copiar. Mantén presionado el texto, elige “Seleccionar todo” y copia."; return pintar(); }
    case "whatsapp": { window.open(urlWhatsApp(contenido().texto), "_blank", "noopener"); H.ok = true; H.msg = "Abriendo WhatsApp…"; return pintar(); }
    case "pdf": H.ok = true; H.msg = "Elige “Guardar como PDF” en la ventana de impresión."; pintar(); return imprimir();
  }
}
