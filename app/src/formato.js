// Funciones puras de presentación (sin DOM): se prueban con node --test.

export const CATEGORIAS = [
  { id: "desayuno", nombre: "Desayunos" },
  { id: "bebida_desayuno", nombre: "Bebidas de desayuno" },
  { id: "almuerzo", nombre: "Almuerzos" },
  { id: "acompanamiento", nombre: "Acompañamientos" },
  { id: "lonchera", nombre: "Loncheras" },
  { id: "fruta_lonchera", nombre: "Frutas" },
  { id: "refresco", nombre: "Refrescos" },
  { id: "licuado_cena", nombre: "Cena de apoyo" },
];

const HARINA = { a: "arroz", f: "fideo", p: "pan", h: "harina" };

export function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Quita tildes y pasa a minúsculas, para buscar sin importar acentos.
export function normalizar(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function num(n) {
  const ent = Math.trunc(n);
  const dec = Math.round((n - ent) * 100) / 100;
  const frac = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[dec];
  if (dec === 0) return String(ent);
  if (frac) return ent === 0 ? frac : `${ent}${frac}`;
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

export function formatoCantidad(ing) {
  if (ing.cant == null) return "al gusto";
  return `${num(ing.cant)} ${ing.unidad}`;
}

// Etiquetas de colores para una tarjeta de plato: [{texto, clase}]
export function etiquetas(p) {
  const e = [];
  const m = p.marcas;
  if (m) {
    if (m.pescado === "visible") e.push({ texto: "pescado", clase: "pez" });
    if (m.pescado === "camuflado") e.push({ texto: "pescado camuflado", clase: "pez" });
    if (m.menestra) e.push({ texto: "menestra", clase: "ver" });
    if (m.verdura) e.push({ texto: "verdura", clase: "ver" });
    if (m.camote) e.push({ texto: "camote", clase: "ver" });
    for (const h of m.harina || []) e.push({ texto: HARINA[h] || h, clase: "har" });
  }
  if (p.origen === "usuario") e.push({ texto: "tuyo", clase: "nue" });
  if (p.nuevo) e.push({ texto: "nuevo", clase: "nue" });
  if (p.revisar) e.push({ texto: "tentativo", clase: "ten" });
  return e;
}

export function filtrarPlatos(platos, { categoria = "todos", texto = "" } = {}) {
  const q = normalizar(texto);
  return platos.filter((p) => (categoria === "todos" || p.categoria === categoria) && (!q || normalizar(p.nombre).includes(q)));
}
