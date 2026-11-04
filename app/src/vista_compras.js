// Pestaña "Compras": insumos de la semana para 3 o 4 personas, con "ya compré" y "ya tengo en casa".
import { calcularCompras } from "./compras.js";
import { semanaActual, guardarSemana } from "./vista_semana.js";
import { escapar } from "./formato.js";
import { etiquetaSemana } from "./semana.js";
import * as db from "./db.js";

let datos;
const C = { personas: 4, tengo: [] };

export async function iniciarCompras(d) {
  datos = d;
  try { C.personas = await db.ajuste("personas", 4); C.tengo = await db.ajuste("despensa", []); } catch { /* valores por defecto */ }
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
}

export const personasActuales = () => C.personas;
export const resultadoCompras = () => resultado();
const resultado = () => {
  const s = semanaActual();
  s.comprado ||= []; s.basicos_faltan ||= [];
  const porId = new Map(datos.platos.map((p) => [p.id, p]));
  return calcularCompras(s, porId, datos.ingPorId, { personas: C.personas, tengo: C.tengo, comprado: s.comprado, basicosFaltan: s.basicos_faltan });
};

export function pintarCompras(v) {
  const s = semanaActual(), r = resultado();
  const cab = `
    <div class="comp-cab">
      <div class="pers" role="group" aria-label="Número de personas"><span>Para</span>
        ${[3, 4].map((n) => `<button class="chip${C.personas === n ? " on" : ""}" data-ac="personas" data-n="${n}" aria-pressed="${C.personas === n}">${n}</button>`).join("")}
        <span>personas</span>
        <button class="mas sec cmp-comp" data-sh="abrir" data-que="compras">📤 Compartir</button></div>
      <p class="comp-nota">Semana del ${escapar(etiquetaSemana(s.id))}. El almuerzo cuenta doble (la cena es el sobrante) y la lonchera es de 1 niño.</p>
    </div>`;
  if (r.vacio) {
    v.innerHTML = `${cab}<section class="vacio"><h2>Todavía no hay nada que comprar</h2><p>Arma algunas comidas de la semana y aquí aparecerán los insumos.</p><button class="mas" data-ac="ir-semana">Ir a Semana</button></section>`;
    return;
  }
  const pct = r.total ? Math.round((r.compradosN / r.total) * 100) : 0;
  v.innerHTML = `${cab}
    ${r.avisos.map((a) => `<p class="aviso ${a.tipo === "tentativo" ? "" : "ten"}">${escapar(a.texto)}</p>`).join("")}
    <div class="progreso" aria-label="Avance de compras"><div class="barra"><i style="width:${pct}%"></i></div><span>Comprado ${r.compradosN} de ${r.total}</span></div>
    ${r.grupos.map(htmlGrupo).join("")}
    ${htmlBasicos(r)}
    ${htmlTengo(r)}`;
}

const htmlGrupo = (g) => `<section class="grupo"><h3>${escapar(g.grupo)}</h3><ul class="items">${g.items.map(htmlItem).join("")}</ul></section>`;
function htmlItem(i) {
  const sub = [i.dias, i.necesita].filter(Boolean).join(" · ");
  return `<li class="item${i.comprado ? " hecho" : ""}">
    <label class="chk"><input type="checkbox" data-ac="comprado" data-id="${escapar(i.id)}"${i.comprado ? " checked" : ""}>
      <span class="nom"><b>${escapar(i.nombre)}</b>${sub ? `<small>${escapar(sub)}</small>` : ""}</span></label>
    <span class="cant">${escapar(i.texto)}</span>
    ${i.basico ? "" : `<button class="tengo" data-ac="tengo" data-id="${escapar(i.id)}" title="Ya lo tengo en casa" aria-label="Ya tengo ${escapar(i.nombre)} en casa">🏠</button>`}
  </li>`;
}
function htmlBasicos(r) {
  if (!r.basicos.length) return "";
  return `<details class="extra"><summary>Básicos de la semana (${r.basicos.length})</summary>
    <p class="aviso">Aceite, sal, ajo… Se asume que ya los tienes. Marca los que te <strong>falten</strong> y pasan a la lista.</p>
    <ul class="items">${r.basicos.map((b) => `<li class="item"><label class="chk"><input type="checkbox" data-ac="basico-falta" data-id="${escapar(b.id)}"${b.falta ? " checked" : ""}><span class="nom"><b>${escapar(b.nombre)}</b></span></label><span class="cant">${b.falta ? "me falta" : "lo tengo"}</span></li>`).join("")}</ul></details>`;
}
function htmlTengo(r) {
  if (!r.yaTengo.length) return "";
  return `<details class="extra"><summary>Ya tengo en casa (${r.yaTengo.length})</summary>
    <p class="aviso">Estos no se compran. Quítalos de aquí si se acabaron.</p>
    <ul class="items">${r.yaTengo.map((t) => `<li class="item"><span class="nom"><b>${escapar(t.nombre)}</b></span><button class="tengo" data-ac="quitar-tengo" data-id="${escapar(t.id)}">Volver a la lista</button></li>`).join("")}</ul></details>`;
}

const repintar = () => {
  const v = document.querySelector("#vista");
  if (!v || !document.querySelector(".comp-cab")) return;
  const abiertos = [...v.querySelectorAll("details.extra")].map((d) => d.open);   // no cerrar lo que el usuario abrió
  pintarCompras(v);
  v.querySelectorAll("details.extra").forEach((d, i) => { d.open = !!abiertos[i]; });
};
const alternar = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

async function onClick(e) {
  const b = e.target.closest("button[data-ac]");
  if (!b || !datos) return;
  const { ac, n, id } = b.dataset;
  if (ac === "personas") { C.personas = Number(n); try { await db.guardarAjuste("personas", C.personas); } catch {} return repintar(); }
  if (ac === "tengo") { C.tengo = [...new Set([...C.tengo, id])]; try { await db.guardarAjuste("despensa", C.tengo); } catch {} return repintar(); }
  if (ac === "quitar-tengo") { C.tengo = C.tengo.filter((x) => x !== id); try { await db.guardarAjuste("despensa", C.tengo); } catch {} return repintar(); }
  if (ac === "ir-semana") document.querySelector('[data-tab="semana"]')?.click();
}
async function onChange(e) {
  const i = e.target.closest('input[type="checkbox"][data-ac]');
  if (!i || !datos) return;
  const s = semanaActual();
  if (i.dataset.ac === "comprado") { s.comprado = alternar(s.comprado || [], i.dataset.id); await guardarSemana(); repintar(); }
  if (i.dataset.ac === "basico-falta") { s.basicos_faltan = alternar(s.basicos_faltan || [], i.dataset.id); await guardarSemana(); repintar(); }
}
