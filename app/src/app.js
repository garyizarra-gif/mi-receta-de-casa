import { cargarDatos } from "./datos.js";
import { CATEGORIAS, escapar, etiquetas, filtrarPlatos, formatoCantidad } from "./formato.js";
import { ajuste, guardarAjuste } from "./db.js";
import { iniciarSemana, pintarSemana } from "./vista_semana.js";
import { iniciarCompras, pintarCompras } from "./vista_compras.js";
import { iniciarPropios } from "./vista_propios.js";
import { iniciarCompartir } from "./vista_compartir.js";
import { iniciarCocino, pintarCocino } from "./vista_cocino.js";

const TABS = [
  { id: "semana", icono: "📅", nombre: "Semana" },
  { id: "compras", icono: "🛒", nombre: "Compras" },
  { id: "platos", icono: "📖", nombre: "Platos" },
  { id: "cocino", icono: "📷", nombre: "¿Qué cocino?" },
];
const PROXIMAMENTE = {
};

const estado = { tab: "semana", categoria: "todos", texto: "", datos: null };
const $ = (s) => document.querySelector(s);

function pintarTabs() {
  $("#tabs").innerHTML = TABS.map((t) =>
    `<button class="tab" role="tab" data-tab="${t.id}" aria-selected="${t.id === estado.tab}"><span class="ico" aria-hidden="true">${t.icono}</span><span>${escapar(t.nombre)}</span></button>`
  ).join("");
}

function pintarVista() {
  const v = $("#vista");
  if (estado.tab === "platos") return pintarPlatos(v);
  if (estado.tab === "semana") return pintarSemana(v);
  if (estado.tab === "compras") return pintarCompras(v);
  if (estado.tab === "cocino") return pintarCocino(v);
  const p = PROXIMAMENTE[estado.tab];
  v.innerHTML = `<section class="vacio"><h2>${escapar(p.titulo)}</h2><p>${escapar(p.texto)}</p><span class="chip chip-fase">Viene en la ${escapar(p.fase)}</span></section>`;
}

function pintarPlatos(v) {
  const chips = [{ id: "todos", nombre: "Todos" }, ...CATEGORIAS].map((c) =>
    `<button class="chip${c.id === estado.categoria ? " on" : ""}" data-cat="${c.id}">${escapar(c.nombre)}</button>`).join("");
  v.innerHTML = `
    <div class="barra-platos"><button class="mas" data-ap="nuevo" data-cat-nueva="${estado.categoria === "todos" ? "almuerzo" : estado.categoria}">+ Nuevo plato</button><button class="mas sec" data-ap="respaldo">Copia de seguridad</button></div>
    <div class="buscar"><input id="q" type="search" placeholder="Buscar un plato…" autocomplete="off" value="${escapar(estado.texto)}" aria-label="Buscar un plato"></div>
    <div class="chips" role="group" aria-label="Categoría">${chips}</div>
    <p id="cuenta" class="cuenta"></p>
    <ul id="lista" class="lista"></ul>`;
  pintarLista();
}

function pintarLista() {
  const items = filtrarPlatos(estado.datos.platos, { categoria: estado.categoria, texto: estado.texto });
  $("#cuenta").textContent = items.length === 1 ? "1 plato" : `${items.length} platos`;
  $("#lista").innerHTML = items.length
    ? items.map((p) => `
      <li><button class="plato" data-id="${escapar(p.id)}">
        <span class="nombre">${escapar(p.nombre)}</span>
        <span class="tags">${etiquetas(p).map((e) => `<span class="tag ${e.clase}">${escapar(e.texto)}</span>`).join("")}</span>
      </button></li>`).join("")
    : `<li class="sinres">No encontré ningún plato con ese nombre.</li>`;
}

function abrirDetalle(id) {
  const p = estado.datos.platos.find((x) => x.id === id);
  if (!p) return;
  const ings = !p.ingredientes.length ? `<li class="sin-ing">Sin ingredientes todavía${p.notas_ingredientes ? `: ${escapar(p.notas_ingredientes)}` : ""}.</li>` : p.ingredientes.map((i) => {
    const info = estado.datos.ingPorId[i.id];
    return `<li><span>${escapar(info ? info.nombre : i.id)}</span><span class="cant">${escapar(formatoCantidad(i))}</span></li>`;
  }).join("");
  const nota = [];
  if (p.revisar) nota.push(`<p class="aviso ten">${escapar(p.revisar)}</p>`);
  if (p.lista_confirmada) nota.push(`<p class="aviso ok">Los ingredientes de este plato los confirmaste tú.</p>`);
  nota.push(p.origen === "usuario"
    ? `<div class="acciones"><button class="mas" data-ap="editar" data-id="${escapar(p.id)}">✏️ Editar</button><button class="mas peligro" data-ap="eliminar" data-id="${escapar(p.id)}">🗑 Eliminar</button></div>`
    : `<div class="acciones"><button class="mas" data-ap="editar" data-id="${escapar(p.id)}">📝 Duplicar y editar</button></div>`);
  nota.push(`<p class="aviso">Cantidades <strong>estimadas</strong>, por ${escapar(p.porcion)}. Agua no se cuenta; los básicos van “al gusto”.</p>`);
  $("#detalle-cuerpo").innerHTML = `
    <h2>${escapar(p.nombre)}</h2>
    <p class="tags">${etiquetas(p).map((e) => `<span class="tag ${e.clase}">${escapar(e.texto)}</span>`).join("")}</p>
    <h3>Ingredientes</h3>
    <ul class="ings">${ings}</ul>
    ${nota.join("")}`;
  $("#detalle").showModal();
}

function conectar() {
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    estado.tab = b.dataset.tab;
    guardarAjuste("tab", estado.tab).catch(() => {});
    pintarTabs(); pintarVista();
    window.scrollTo(0, 0);
  });
  $("#vista").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]");
    if (c) { estado.categoria = c.dataset.cat; pintarVista(); return; }
    const p = e.target.closest("[data-id]");
    if (p) abrirDetalle(p.dataset.id);
  });
  $("#vista").addEventListener("input", (e) => {
    if (e.target.id === "q") { estado.texto = e.target.value; pintarLista(); }
  });
  const d = $("#detalle");
  $("#cerrar").addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
}

async function iniciar() {
  try {
    estado.datos = await cargarDatos();
  } catch (err) {
    $("#vista").innerHTML = `<section class="vacio"><h2>No se pudieron cargar los datos</h2><p>${escapar(err.message)}</p></section>`;
    return;
  }
  try { estado.tab = await ajuste("tab", "semana"); } catch { /* usa el valor por defecto */ }
  if (!TABS.some((t) => t.id === estado.tab)) estado.tab = "semana";
  await iniciarSemana(estado.datos);
  await iniciarCompras(estado.datos);
  iniciarPropios(estado.datos, () => { if (estado.tab === "platos") pintarVista(); });
  iniciarCompartir(estado.datos);
  await iniciarCocino(estado.datos);
  conectar(); pintarTabs(); pintarVista();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
}
iniciar();
