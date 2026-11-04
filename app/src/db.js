// Almacenamiento local (IndexedDB). Si el navegador lo bloquea (modo privado, etc.), se usa memoria y la app sigue funcionando.
// Tiendas: platos_usuario (platos propios), ingredientes_usuario (ingredientes propios), semanas, ajustes. Los platos de la base NO se guardan aquí: viajan en data/platos.json.
const NOMBRE = "menu-de-casa";
const VERSION = 2;
const TIENDAS = { platos_usuario: "id", ingredientes_usuario: "id", semanas: "id", ajustes: "clave" };
const memoria = { platos_usuario: new Map(), ingredientes_usuario: new Map(), semanas: new Map(), ajustes: new Map() };
let dbPromesa = null;

function abrir() {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((resolve) => {
    try {
      const req = indexedDB.open(NOMBRE, VERSION);
      req.onupgradeneeded = () => {
        for (const [t, k] of Object.entries(TIENDAS)) if (!req.result.objectStoreNames.contains(t)) req.result.createObjectStore(t, { keyPath: k });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      setTimeout(() => resolve(null), 2000); // si el navegador no responde, se sigue sin guardar en disco
    } catch { resolve(null); }
  });
  return dbPromesa;
}

function pedir(db, tienda, modo, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tienda, modo);
    const r = fn(tx.objectStore(tienda));
    tx.oncomplete = () => resolve(r?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function todos(tienda) {
  const db = await abrir();
  if (!db) return [...memoria[tienda].values()];
  return (await pedir(db, tienda, "readonly", (s) => s.getAll())) || [];
}
export async function leer(tienda, clave) {
  const db = await abrir();
  if (!db) return memoria[tienda].get(clave);
  return pedir(db, tienda, "readonly", (s) => s.get(clave));
}
export async function guardar(tienda, objeto) {
  const db = await abrir();
  const clave = objeto[TIENDAS[tienda]];
  if (!db) { memoria[tienda].set(clave, objeto); return; }
  await pedir(db, tienda, "readwrite", (s) => s.put(objeto));
}
export async function borrar(tienda, clave) {
  const db = await abrir();
  if (!db) { memoria[tienda].delete(clave); return; }
  await pedir(db, tienda, "readwrite", (s) => s.delete(clave));
}

export async function ajuste(clave, porDefecto) {
  const r = await leer("ajustes", clave);
  return r ? r.valor : porDefecto;
}
export function guardarAjuste(clave, valor) { return guardar("ajustes", { clave, valor }); }
