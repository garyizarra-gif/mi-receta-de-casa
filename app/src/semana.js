// Lógica pura de la semana (sin DOM): crear/copiar semanas, plantillas, refrescos sugeridos y el resumen con semáforo.
// Una comida = { platos: [id], bebidas: [id], frutas: [id], acomp: [id], nota?: texto }.
// Una semana  = { id: "YYYY-MM-DD" (lunes), dias: { lunes: { desayuno, lonchera, almuerzo, cena: { apoyo: id|null } }, ... } }

export const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];
export const NOMBRE_DIA = { lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes" };
export const COMIDAS = ["desayuno", "lonchera", "almuerzo"];
export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Reglas acordadas con el usuario (todas son solo avisos).
export const UMBRALES = { harinaPorDia: 3, arrozDias: 3, fideoDias: 2, pescadoDias: 2, menestrasAlmuerzos: 2 };

// Orden en que se sugieren los refrescos del almuerzo (primero los pedidos por el usuario).
export const ORDEN_REFRESCOS = ["r13", "r01", "r14", "r15", "r05", "r06", "r02", "r04", "r03", "r07", "r08"];

export const comidaVacia = () => ({ platos: [], bebidas: [], frutas: [], acomp: [] });

// ---------- fechas (todo en UTC para evitar corrimientos de zona horaria) ----------
const aFecha = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const aISO = (f) => f.toISOString().slice(0, 10);
export function sumarDias(iso, n) { const f = aFecha(iso); f.setUTCDate(f.getUTCDate() + n); return aISO(f); }
export function lunesDe(iso) { const f = aFecha(iso); return sumarDias(iso, -((f.getUTCDay() + 6) % 7)); }
// Sábado o domingo: se arma la semana que viene; si no, la semana en curso.
export function semanaPorDefecto(hoyISO) {
  const dow = (aFecha(hoyISO).getUTCDay() + 6) % 7;
  return dow >= 5 ? sumarDias(lunesDe(hoyISO), 7) : lunesDe(hoyISO);
}
export function etiquetaSemana(lunesISO) {
  const a = aFecha(lunesISO), b = aFecha(sumarDias(lunesISO, 4));
  const ma = MESES[a.getUTCMonth()], mb = MESES[b.getUTCMonth()];
  return ma === mb ? `${a.getUTCDate()} – ${b.getUTCDate()} ${mb}` : `${a.getUTCDate()} ${ma} – ${b.getUTCDate()} ${mb}`;
}

// ---------- crear / copiar ----------
export function crearSemana(lunesISO) {
  const dias = {};
  for (const d of DIAS) dias[d] = { desayuno: comidaVacia(), lonchera: comidaVacia(), almuerzo: comidaVacia(), cena: { apoyo: null } };
  return { id: lunesISO, dias };
}
const clon = (x) => JSON.parse(JSON.stringify(x));

export function semanaEstaVacia(s) {
  return DIAS.every((d) => COMIDAS.every((c) => { const x = s.dias[d][c]; return !x.platos.length && !x.bebidas.length && !x.frutas.length && !x.acomp.length; }) && !s.dias[d].cena.apoyo);
}
// Copia una semana a otro lunes (sin las notas de texto original).
export function copiarSemana(origen, lunesISO) {
  const s = clon(origen); s.id = lunesISO;
  for (const d of DIAS) for (const c of COMIDAS) delete s.dias[d][c].nota;
  return s;
}
// Aplica una plantilla (de los menús del usuario) sobre una semana nueva con el mismo id.
export function aplicarPlantilla(semana, plantilla) {
  const s = crearSemana(semana.id);
  for (const d of DIAS) {
    const pd = plantilla.dias[d];
    if (!pd) continue;
    for (const c of COMIDAS) if (pd[c]) s.dias[d][c] = { ...comidaVacia(), ...clon(pd[c]) };
  }
  return s;
}
export function vaciarSemana(semana) { return crearSemana(semana.id); }

// ---------- editar una comida ----------
export function agregar(comida, campo, id) { if (!comida[campo].includes(id)) comida[campo].push(id); }
export function quitar(comida, campo, id) { comida[campo] = comida[campo].filter((x) => x !== id); }

// ---------- refrescos del almuerzo: uno distinto por día, sin repetir el de la lonchera ----------
export function sugerirRefrescos(semana, orden = ORDEN_REFRESCOS) {
  const s = clon(semana);
  const usados = new Set(DIAS.flatMap((d) => s.dias[d].almuerzo.bebidas));
  let rot = 0;
  for (const d of DIAS) {
    const alm = s.dias[d].almuerzo;
    if (alm.bebidas.length) continue;
    const lonch = new Set(s.dias[d].lonchera.bebidas);
    let elegido = orden.find((r) => !usados.has(r) && !lonch.has(r));
    if (!elegido) { elegido = orden.filter((r) => !lonch.has(r))[rot % Math.max(1, orden.length - lonch.size)]; rot++; }
    alm.bebidas.push(elegido);
    usados.add(elegido);
  }
  return s;
}

// ---------- resumen de la semana (semáforo, solo avisos) ----------
const objetos = (c, porId) => [...c.platos, ...c.acomp].map((id) => porId.get(id)).filter(Boolean);
const harinasDe = (c, porId) => new Set(objetos(c, porId).flatMap((p) => p.marcas?.harina || []));
const tieneMarca = (c, porId, f) => objetos(c, porId).some(f);
const hayDatos = (s) => !semanaEstaVacia(s);
const nombresDias = (ds) => ds.map((d) => NOMBRE_DIA[d]).join(", ");

export function resumenSemana(semana, porId, u = UMBRALES) {
  if (!hayDatos(semana)) return [
    { id: "harinas", titulo: "Harinas", estado: "pendiente", mensaje: "Arma algunos días para ver el resumen." },
    { id: "pescado", titulo: "Pescado", estado: "pendiente", mensaje: "" },
    { id: "menestras", titulo: "Menestras", estado: "pendiente", mensaje: "" },
    { id: "verduras", titulo: "Verduras", estado: "pendiente", mensaje: "" },
  ];
  const out = [];

  // Harinas
  const avisos = [];
  const muchas = DIAS.filter((d) => COMIDAS.filter((c) => harinasDe(semana.dias[d][c], porId).size > 0).length >= u.harinaPorDia);
  if (muchas.length) avisos.push(`${nombresDias(muchas)}: arroz, fideo, pan o harina en las ${u.harinaPorDia} comidas. Prueba cambiar una por verdura, camote o menestra.`);
  const diasCon = (h) => DIAS.filter((d) => COMIDAS.some((c) => harinasDe(semana.dias[d][c], porId).has(h)));
  const arroz = diasCon("a"), fideo = diasCon("f");
  if (arroz.length > u.arrozDias) avisos.push(`Hay arroz ${arroz.length} días (${nombresDias(arroz)}). Se sugiere bajarlo a ${u.arrozDias}.`);
  if (fideo.length > u.fideoDias) avisos.push(`Hay fideo ${fideo.length} días (${nombresDias(fideo)}). Se sugiere bajarlo a ${u.fideoDias}.`);
  out.push({ id: "harinas", titulo: "Harinas", estado: avisos.length ? "aviso" : "ok", mensaje: avisos.length ? avisos.join(" ") : "Bien: sin exceso de harinas." });

  // Pescado: cuenta el visible y el camuflado, en cualquier comida
  const pescado = DIAS.filter((d) => COMIDAS.some((c) => tieneMarca(semana.dias[d][c], porId, (p) => p.marcas && p.marcas.pescado !== "ninguno")));
  out.push({ id: "pescado", titulo: "Pescado", estado: pescado.length >= u.pescadoDias ? "ok" : "aviso",
    mensaje: pescado.length >= u.pescadoDias ? `Bien: ${pescado.length} días con pescado (${nombresDias(pescado)}).`
      : `${pescado.length === 0 ? "No hay pescado" : "Solo hay 1 día con pescado"} esta semana; la meta es ${u.pescadoDias}. Prueba una tortilla de atún o una hamburguesa de pescado.` });

  // Menestras (en el almuerzo)
  const menestras = DIAS.filter((d) => tieneMarca(semana.dias[d].almuerzo, porId, (p) => p.marcas?.menestra));
  out.push({ id: "menestras", titulo: "Menestras", estado: menestras.length >= u.menestrasAlmuerzos ? "ok" : "aviso",
    mensaje: menestras.length >= u.menestrasAlmuerzos ? `Bien: ${menestras.length} almuerzos con menestras.` : `Hay ${menestras.length} almuerzo(s) con menestras; la meta es ${u.menestrasAlmuerzos}. Prueba lentejas, frijol o garbanzo.` });

  // Verduras: una en cada almuerzo ya armado
  const armados = DIAS.filter((d) => semana.dias[d].almuerzo.platos.length);
  const sinVerdura = armados.filter((d) => !tieneMarca(semana.dias[d].almuerzo, porId, (p) => p.marcas?.verdura));
  out.push({ id: "verduras", titulo: "Verduras", estado: sinVerdura.length ? "aviso" : "ok",
    mensaje: sinVerdura.length ? `${nombresDias(sinVerdura)}: el almuerzo no tiene verdura. Agrega una ensalada.` : "Bien: todos los almuerzos armados tienen verdura." });
  return out;
}

// ---------- texto para mostrar ----------
export function textoComida(c, porId) {
  const n = (ids) => ids.map((id) => porId.get(id)?.nombre ?? id);
  return { principal: n(c.platos).join(" + "), extra: [...n(c.acomp), ...n(c.frutas), ...n(c.bebidas)].join(" · ") };
}
