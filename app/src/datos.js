// Carga los datos: platos de la base (data/platos.json) + platos propios del usuario (IndexedDB).
import { todos } from "./db.js";

async function json(ruta) {
  const r = await fetch(ruta, { cache: "no-store" });
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta}`);
  return r.json();
}

export async function cargarDatos() {
  const [base, ingredientes, plantillas] = await Promise.all([json("data/platos.json"), json("data/ingredientes.json"), json("data/plantillas.json")]);
  let propios = [], ingPropios = [];
  try { propios = await todos("platos_usuario"); ingPropios = await todos("ingredientes_usuario"); } catch { /* sin almacenamiento: solo base */ }
  const platos = [...base.map((p) => ({ ...p, origen: "base" })), ...propios.map((p) => ({ ...p, origen: "usuario" }))];
  const todosIng = [...ingredientes, ...ingPropios];
  const ingPorId = Object.fromEntries(todosIng.map((i) => [i.id, i]));
  return { platos, ingredientes: todosIng, ingPorId, plantillas };
}
