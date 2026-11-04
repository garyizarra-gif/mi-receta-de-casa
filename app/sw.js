// Service worker: "primero la red, si no hay red la copia guardada".
// Así las actualizaciones SIEMPRE llegan a quien ya instaló la app, y sin internet sigue abriendo.
const CACHE = "menu-de-casa-v7";
const BASICOS = ["./", "index.html", "styles.css", "manifest.webmanifest",
  "src/app.js", "src/datos.js", "src/db.js", "src/formato.js", "src/semana.js", "src/vista_semana.js", "src/compras.js", "src/vista_compras.js", "src/propios.js", "src/respaldo.js", "src/vista_propios.js", "src/compartir.js", "src/vista_compartir.js", "src/cocinar.js", "src/menu_dia.js", "src/vista_cocino.js",
  "data/platos.json", "data/ingredientes.json", "data/plantillas.json", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-store" })
      .then((res) => {
        if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
