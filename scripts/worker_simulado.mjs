// Servidor de PRUEBA que ejecuta el código REAL del intermediario (worker/src/nucleo.js: autenticación, CORS, validación,
// tope de gasto…) pero con un Claude de mentira que siempre "ve" los mismos insumos. Sirve para probar la app de punta a punta
// sin clave de API ni Cloudflare. Uso: node scripts/worker_simulado.mjs [puerto]
// Rutas solo de prueba: GET /__ultimo (qué recibió) y GET /__gasto?v=1.99 (fija el gasto del mes para probar el tope).
import { createServer } from "node:http";
import { manejar } from "../worker/src/nucleo.js";

const PUERTO = Number(process.argv[2]) || 8770;
const memoria = new Map();
let ultimo = null;
const VISTOS = ["pollo", "papa", "cebolla", "aji_amarillo", "pan_molde", "leche_evaporada", "queso_parmesano"];   // los de un ají de gallina
const env = {
  ANTHROPIC_API_KEY: "clave-simulada", APP_TOKEN: "prueba123", ORIGENES: "http://127.0.0.1:8765", TOPE_MES_USD: "2",
  CONTADOR: { get: async (k) => memoria.get(k) ?? null, put: async (k, v) => { memoria.set(k, String(v)); } },
};
const deps = {
  ahora: () => new Date(),
  crearCliente: () => ({ messages: { parse: async (p) => {
    if (p.system.includes("MENÚ DEL DÍA")) {            // pedido de menú: elige el primer candidato de cada lista (prefiere los que no faltan nada)
      const texto = p.messages[0].content[0].text;
      ultimo = { tipo: "menu", texto, modelo: p.model };
      const seccion = (t) => { const m = texto.match(new RegExp(t + "[^\\n]*:\\n([\\s\\S]*?)(\\n\\n|\\n[A-ZÁÉÍÓÚ_ ]+( \\(candidatos\\))?:\\n|$)")); return m ? m[1].split("\n").filter((l) => l.includes(" | ")) : []; };
      const ids = (t) => seccion(t).map((l) => l.split(" | ")[0]);
      const mejor = (t) => { const l = seccion(t); return (l.find((x) => x.includes("falta: nada")) || l[0] || "").split(" | ")[0] || ""; };
      return { stop_reason: "end_turn", usage: { input_tokens: 2500, output_tokens: 400 }, parsed_output: {
        desayuno_plato: mejor("DESAYUNO"), desayuno_bebida: ids("BEBIDAS_DESAYUNO")[0] || "", lonchera_plato: mejor("LONCHERA"), lonchera_frutas: ids("FRUTAS_LONCHERA").slice(0, 1), lonchera_refresco: ids("REFRESCOS")[0] || "",
        almuerzo_plato: mejor("ALMUERZO"), almuerzo_acomp: ids("ACOMPAÑAMIENTOS").slice(0, 1), almuerzo_refresco: ids("REFRESCOS")[1] || "",
        explicacion: "Menú simulado de prueba: elegí lo que menos te hace falta comprar.", falta_comprar: [], ideas: ["Un licuado de plátano para la cena"] } };
    }
    const imgs = p.messages[0].content.filter((c) => c.type === "image");
    ultimo = { imagenes: imgs.length, media_type: imgs[0]?.source.media_type, bytes_b64: imgs.reduce((n, i) => n + i.source.data.length, 0), catalogo: p.system.split("\n").filter((l) => /^[a-z0-9_]+: /.test(l)).length, modelo: p.model, sistema_incluye_token: p.system.includes("prueba123") };
    return { stop_reason: "end_turn", parsed_output: { ingredientes: [...VISTOS, "ingrediente_que_no_existe"], otros: ["rocoto"] }, usage: { input_tokens: 1500, output_tokens: 80 } };
  } } }),
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
  const abierto = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (url.pathname === "/__ultimo") { res.writeHead(200, abierto).end(JSON.stringify(ultimo ?? {})); return; }
  if (url.pathname === "/__gasto") { memoria.set(`gasto:${new Date().toISOString().slice(0, 7)}`, url.searchParams.get("v") || "0"); res.writeHead(200, abierto).end("{}"); return; }
  const trozos = []; for await (const t of req) trozos.push(t);
  const cuerpo = Buffer.concat(trozos);
  const r = await manejar(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : cuerpo }), env, deps);
  res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
}).listen(PUERTO, "127.0.0.1", () => console.log(`Servicio de fotos SIMULADO en http://127.0.0.1:${PUERTO} (código de acceso: prueba123)`));
