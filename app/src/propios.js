// Platos e ingredientes propios del usuario (lógica pura, sin DOM).
// Un "borrador" es lo que se edita en el formulario: { id?, categoria, nombre, ingredientes:[{id,cant,unidad}], marcas, notas }.

export const CATEGORIAS_PROPIAS = [
  { id: "desayuno", nombre: "Desayuno", porcion: "adulto", base: "por_persona" },
  { id: "almuerzo", nombre: "Almuerzo", porcion: "adulto", base: "por_persona" },
  { id: "lonchera", nombre: "Lonchera (bocado)", porcion: "niño", base: "por_persona" },
  { id: "acompanamiento", nombre: "Acompañamiento", porcion: "adulto", base: "por_persona" },
  { id: "bebida_desayuno", nombre: "Bebida de desayuno", porcion: "vaso 250 ml", base: "por_persona" },
  { id: "fruta_lonchera", nombre: "Fruta de lonchera", porcion: "niño", base: "por_persona" },
  { id: "refresco", nombre: "Refresco", porcion: "1 litro (4 vasos)", base: "por_litro" },
  { id: "licuado_cena", nombre: "Licuado de cena", porcion: "1 jarra (~1 litro)", base: "por_licuado" },
];
export const GRUPOS = ["Verduras", "Frutas", "Tubérculos", "Carnes y pescados", "Lácteos y huevos", "Menestras y granos", "Fideos", "Panadería", "Abarrotes"];
export const COMPRAS = [
  { id: "kg", nombre: "Por peso (kg)", unidad: "g" },
  { id: "u", nombre: "Por unidad", unidad: "u" },
  { id: "litro", nombre: "Por litro", unidad: "ml" },
  { id: "docena", nombre: "Por docena", unidad: "u" },
];
export const UNIDADES = ["g", "ml", "u"];
export const HARINAS = [{ id: "a", nombre: "Arroz" }, { id: "f", nombre: "Fideo" }, { id: "p", nombre: "Pan" }, { id: "h", nombre: "Harina o masa" }];

export const infoCategoria = (id) => CATEGORIAS_PROPIAS.find((c) => c.id === id);
export const marcasVacias = () => ({ harina: [], pescado: "ninguno", menestra: false, verdura: false, camote: false, proteina: "" });

// g para lo que se compra por peso, ml para litros, u para unidades; el resto, g.
export function unidadPorDefecto(ing) {
  if (!ing) return "g";
  if (ing.compra === "litro") return "ml";
  if (ing.compra === "u" || ing.compra === "docena") return "u";
  return "g";
}

export function nuevoIdPlato(ahora = Date.now(), azar = Math.random) {
  return "U" + ahora.toString(36) + azar().toString(36).slice(2, 5);
}
export function nuevoIdIngrediente(nombre, existentes) {
  const base = "x_" + String(nombre).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
  let id = base, n = 2;
  while (existentes.has(id)) id = `${base}_${n++}`;
  return id;
}

// "1,5" → 1.5 ; "1/2" → 0.5 ; vacío o ≤ 0 → null
export function parsearCantidad(texto) {
  const t = String(texto ?? "").trim().replace(",", ".");
  if (!t) return null;
  const fr = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  const n = fr ? Number(fr[1]) / Number(fr[2]) : Number(t);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

const clon = (x) => JSON.parse(JSON.stringify(x));
export function borradorNuevo(categoria = "almuerzo") {
  return { id: null, categoria, nombre: "", ingredientes: [], marcas: marcasVacias(), notas: "" };
}
// Copia editable de un plato existente (propio: mismo id; del catálogo: copia nueva con otro nombre).
export function borradorDesde(plato, { copia = false } = {}) {
  return {
    id: copia ? null : plato.id, categoria: plato.categoria, nombre: copia ? `${plato.nombre} (mío)` : plato.nombre,
    ingredientes: clon(plato.ingredientes || []), marcas: { ...marcasVacias(), ...clon(plato.marcas || {}) }, notas: plato.notas_ingredientes || "",
  };
}

export function validarBorrador(b, ingPorId) {
  const errores = [];
  const nombre = String(b.nombre || "").trim();
  if (nombre.length < 2) errores.push({ campo: "nombre", texto: "Escribe el nombre del plato." });
  if (nombre.length > 80) errores.push({ campo: "nombre", texto: "El nombre es demasiado largo (máximo 80 letras)." });
  if (!infoCategoria(b.categoria)) errores.push({ campo: "categoria", texto: "Elige una categoría." });
  const vistos = new Set();
  b.ingredientes.forEach((i, k) => {
    const nom = ingPorId[i.id]?.nombre ?? i.id;
    if (!ingPorId[i.id]) errores.push({ campo: `ing-${k}`, texto: `“${nom}” no existe en tus ingredientes.` });
    if (vistos.has(i.id)) errores.push({ campo: `ing-${k}`, texto: `“${nom}” está repetido.` });
    vistos.add(i.id);
    if (i.cant == null && ingPorId[i.id]?.basico) return;   // básico "al gusto" (aceite, sal, ajo…): la cantidad es opcional
    if (!(Number.isFinite(i.cant) && i.cant > 0)) errores.push({ campo: `ing-${k}`, texto: `Falta la cantidad de “${nom}”.` });
    if (!UNIDADES.includes(i.unidad)) errores.push({ campo: `ing-${k}`, texto: `Unidad no válida en “${nom}”.` });
  });
  return { ok: errores.length === 0, errores };
}

// Arma el plato guardable a partir de un borrador válido.
export function construirPlato(b, ahora = Date.now()) {
  const cat = infoCategoria(b.categoria);
  return {
    id: b.id || nuevoIdPlato(ahora), categoria: b.categoria, nombre: b.nombre.trim(), porcion: cat.porcion, base: cat.base,
    ingredientes: b.ingredientes.map((i) => (i.cant == null ? { id: i.id, cant: null, unidad: null } : { id: i.id, cant: i.cant, unidad: i.unidad })),
    notas_ingredientes: (b.notas || "").trim(), marcas: { ...marcasVacias(), ...b.marcas },
    estado: "estimado", nuevo: false, revisar: null, lista_confirmada: false,
  };
}

export function ingredienteNuevo({ nombre, grupo, compra }, existentes /* Map|Set de ids */, nombresExistentes = []) {
  const n = String(nombre || "").trim();
  if (n.length < 2) return { ok: false, error: "Escribe el nombre del ingrediente." };
  if (!GRUPOS.includes(grupo)) return { ok: false, error: "Elige el grupo (dónde se compra)." };
  const c = COMPRAS.find((x) => x.id === compra);
  if (!c) return { ok: false, error: "Elige cómo se compra." };
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (nombresExistentes.some((x) => norm(x) === norm(n))) return { ok: false, error: `Ya existe un ingrediente llamado “${n}”.` };
  const ids = existentes instanceof Set ? existentes : new Set(existentes.keys());
  return { ok: true, ing: { id: nuevoIdIngrediente(n, ids), nombre: n, grupo, compra, basico: false, peso_unidad_g: null, propio: true } };
}

// ---------- borrar un plato propio: se quita también de las semanas guardadas ----------
export function semanasQueUsan(semanas, id) {
  const usa = (s) => Object.values(s.dias).some((d) => ["desayuno", "lonchera", "almuerzo"].some((c) => ["platos", "acomp", "frutas", "bebidas"].some((k) => d[c][k].includes(id))) || d.cena.apoyo === id);
  return semanas.filter(usa).map((s) => s.id);
}
export function quitarPlatoDeSemana(semana, id) {
  const s = clon(semana); let cambio = false;
  for (const d of Object.values(s.dias)) {
    for (const c of ["desayuno", "lonchera", "almuerzo"]) for (const k of ["platos", "acomp", "frutas", "bebidas"]) {
      const antes = d[c][k].length; d[c][k] = d[c][k].filter((x) => x !== id); if (d[c][k].length !== antes) cambio = true;
    }
    if (d.cena.apoyo === id) { d.cena.apoyo = null; cambio = true; }
  }
  return { semana: s, cambio };
}
