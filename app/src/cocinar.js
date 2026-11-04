// "¿Qué cocino?": lógica pura (sin DOM). Dado lo que hay en casa, dice qué platos del catálogo se pueden cocinar ya
// y cuáles están a punto. Los básicos (aceite, sal, ajo…) se dan por existentes, igual que en Compras.

export const CATEGORIAS_COCINAR = [
  { id: "almuerzo", nombre: "Almuerzos" },
  { id: "desayuno", nombre: "Desayunos" },
  { id: "lonchera", nombre: "Loncheras" },
];
export const MAX_FOTOS = 3;
export const MAX_FALTAN = 2;     // "te falta poco" = faltan 1 o 2 ingredientes

// Ingredientes que un plato exige de verdad: los que no son básicos y llevan cantidad.
export function ingredientesNecesarios(plato, ingPorId) {
  const ids = new Set();
  for (const i of plato.ingredientes || []) if (i.cant != null && ingPorId[i.id] && !ingPorId[i.id].basico) ids.add(i.id);
  return [...ids];
}

// tengo: Set de ids. Devuelve los platos de la categoría con lo que tiene y lo que le falta, ordenados de mejor a peor.
export function coincidencias(platos, tengo, ingPorId, { categoria = "almuerzo", maxFaltan = MAX_FALTAN } = {}) {
  const res = [];
  for (const p of platos) {
    if (p.categoria !== categoria) continue;
    const nec = ingredientesNecesarios(p, ingPorId);
    if (!nec.length) continue;                                   // sin ingredientes (plato propio vacío) no se puede evaluar
    const faltan = nec.filter((id) => !tengo.has(id));
    if (faltan.length > maxFaltan) continue;
    res.push({ plato: p, faltan, tiene: nec.length - faltan.length, total: nec.length });
  }
  return res.sort((a, b) => a.faltan.length - b.faltan.length || b.tiene - a.tiene || a.plato.nombre.localeCompare(b.plato.nombre, "es"));
}
export function separar(res) {
  return { listos: res.filter((r) => r.faltan.length === 0), casi: res.filter((r) => r.faltan.length > 0) };
}

// ---------- servicio de fotos ----------
// Lista que se envía al intermediario para que el modelo conteste con ids que existen en ESTA app (incluye los ingredientes propios).
export function catalogoParaFoto(ingredientes) {
  return ingredientes.filter((i) => !i.basico).slice(0, 400).map((i) => ({ id: i.id, nombre: i.nombre.replace(/\s*\(.*\)\s*$/, "").slice(0, 60) }));
}
// La URL del servicio debe ser https (o una red local para probar); así el código de acceso nunca viaja sin cifrar por internet.
export function normalizarUrl(u) {
  const t = String(u || "").trim().replace(/\/+$/, "");
  if (!t) return { ok: false, error: "Escribe la dirección del servicio de fotos." };
  let url;
  try { url = new URL(t); } catch { return { ok: false, error: "La dirección no es válida. Debe empezar con https://" }; }
  const local = /^(localhost|127\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return { ok: false, error: "La dirección debe empezar con https://" };
  if (url.pathname !== "/" && url.pathname !== "") return { ok: false, error: "Escribe solo la dirección principal, sin nada después (por ejemplo https://mi-servicio.workers.dev)." };
  return { ok: true, url: url.origin };
}

// Convierte la respuesta del intermediario en ids válidos de ESTA app y nombres que no se reconocieron.
export function interpretarRespuesta(resp, ingPorId) {
  const ids = [...new Set((resp?.ingredientes || []).filter((i) => typeof i === "string" && ingPorId[i]))];
  const otros = [...new Set((resp?.otros || []).filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean))].slice(0, 15);
  return { ids, otros };
}

// ¿Parece una clave de API (Anthropic u otra) pegada donde va el código de acceso? Esas claves NUNCA deben guardarse en la app.
export function pareceClaveApi(texto) {
  return /^\s*sk-(ant-)?[A-Za-z0-9_-]{12,}/.test(String(texto || ""));
}

export function mensajeError(codigo, datos = {}) {
  const usd = (n) => (typeof n === "number" ? `$${n.toFixed(2)}` : "");
  switch (codigo) {
    case "clave_en_codigo": return "Eso parece tu CLAVE DE API de Anthropic (empieza con sk-). NO la pegues aquí: va solo en Cloudflare. Aquí va el código de acceso, una contraseña que tú inventas (mira la guía, paso 6).";
    case "insumos_invalidos": return "Marca primero algunos insumos que tengas en casa.";
    case "sin_candidatos": return "Con lo que marcaste no encontré platos del catálogo para armar un menú. Agrega más insumos.";
    case "candidatos_invalidos": return "No pude preparar el pedido del menú. Inténtalo otra vez.";
    case "no_autorizado": return "El código de acceso no es correcto. Revísalo en “Conexión del servicio de fotos”.";
    case "tope_mensual": return `Llegaste al tope de gasto del mes (${usd(datos.gastado_mes_usd)} de ${usd(datos.tope_mes_usd)}). Mientras tanto puedes marcar tus insumos a mano. El tope se reinicia el mes que viene.`;
    case "limite_hora": return "Ya enviaste muchas fotos en esta hora. Espera un rato o marca tus insumos a mano.";
    case "configuracion": return "El servicio de fotos todavía no está bien configurado (falta algún dato en Cloudflare). Mira la guía de instalación.";
    case "clave_api": return "El servicio de fotos no pudo entrar a Claude: la clave de API no es válida o no tiene saldo. Revísala en console.anthropic.com.";
    case "anthropic_ocupado": return "Claude está ocupado en este momento. Inténtalo de nuevo en un minuto.";
    case "rechazado": return "Claude no pudo analizar esta foto. Prueba con otra o marca tus insumos a mano.";
    case "respuesta_invalida": return "No pude entender la respuesta. Inténtalo de nuevo o marca tus insumos a mano.";
    case "imagen_muy_grande": return "La foto es demasiado grande. Prueba con otra.";
    case "tipo_de_imagen": case "imagen_invalida": return "Ese archivo no parece una foto válida.";
    case "sin_conexion": return "No pude conectar con el servicio de fotos. Revisa la dirección y tu internet.";
    case "sin_configurar": return "Primero escribe la dirección y el código de acceso en “Conexión del servicio de fotos”.";
    default: return "Algo falló al reconocer la foto. Inténtalo otra vez o marca tus insumos a mano.";
  }
}
