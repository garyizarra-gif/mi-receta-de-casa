// Prueba de interfaz con Edge por CDP (Node 24: WebSocket global). Uso: node cdp.mjs <carpeta_salida>
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const URL = "http://127.0.0.1:8765/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}\\perfil`, "about:blank"], { stdio: "ignore" });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const esperando = new Map(); const errores = [];
async function conectar() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const pag = t.find((x) => x.type === "page");
      if (pag) { ws = new WebSocket(pag.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); return; }
    } catch {}
    await dormir(500);
  }
  throw new Error("no pude conectar con Edge");
}
const enviar = (method, params = {}) => new Promise((res) => { const i = ++id; esperando.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await enviar("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) errores.push("eval: " + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value; };
const esperar = async (cond, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(cond)) return true; await dormir(150); } errores.push("TIMEOUT esperando: " + cond); return false; };
const clic = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; e.click(); return true;})()`);
const foto = async (nombre, alto = 844) => {
  await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: alto, deviceScaleFactor: 1, mobile: true });
  await dormir(250);
  const r = await enviar("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}\\${nombre}.png`, Buffer.from(r.result.data, "base64"));
};
const resultados = [];
const ok = (nombre, valor) => { resultados.push(`${valor ? "OK  " : "FALLA"} ${nombre}`); };

await conectar();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && esperando.has(d.id)) { esperando.get(d.id)(d); esperando.delete(d.id); }
  else if (d.method === "Runtime.exceptionThrown") errores.push("EXCEPCION: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errores.push("console.error: " + d.params.args.map((a) => a.value || a.description).join(" "));
};
await enviar("Runtime.enable"); await enviar("Page.enable");
await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await enviar("Page.navigate", { url: URL });
ok("carga la pestaña Semana", await esperar(`!!document.querySelector('.sem-barra')`));
ok("5 días en pantalla", (await ev(`document.querySelectorAll('.dia').length`)) === 5);

// --- tono oscuro y firma
ok("tono oscuro por defecto", await ev(`getComputedStyle(document.body).backgroundColor === 'rgb(21, 24, 21)'`));
{ const t = await ev(`document.querySelector('.firma').textContent`); resultados.push("     (texto real de la firma: " + JSON.stringify(t) + ")");
  ok("firma: texto 'Elaborado por', logo, '·' y teléfono, en ese orden", /^\s*Elaborado por\s+·\s+Cel\. 965754455\s*$/.test(t) && await ev(`document.querySelector('.firma').firstElementChild.className==='firma-logo'`)); }
ok("firma: el logo (archivo externo) carga", await esperar(`(()=>{const i=document.querySelector('.firma img'); return !!i && i.complete && i.naturalWidth>0 && i.getAttribute('src')==='logo_systemia.png' && i.height===26})()`));
ok("firma: 11px, gris #6b7280, centrada, borde superior fino", await ev(`(()=>{const c=getComputedStyle(document.querySelector('.firma')); return c.fontSize==='11px' && c.color==='rgb(107, 114, 128)' && c.textAlign==='center' && c.borderTopWidth==='1px'})()`));
ok("firma: logo con parpadeo 1.8s y multiply", await ev(`(()=>{const c=getComputedStyle(document.querySelector('.firma img')); return c.animationName==='firma-parpadeo' && c.animationDuration==='1.8s' && c.mixBlendMode==='multiply'})()`));
await enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
ok("firma: sin animación con movimiento reducido", await ev(`getComputedStyle(document.querySelector('.firma img')).animationName==='none'`));
await enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
await enviar("Emulation.setEmulatedMedia", { media: "print" });
ok("firma: sin animación al imprimir", await ev(`getComputedStyle(document.querySelector('.firma img')).animationName==='none'`));
await enviar("Emulation.setEmulatedMedia", { media: "" });
ok("la firma está al final de la página, sobre la barra de pestañas", await ev(`(()=>{const f=document.querySelector('.firma').getBoundingClientRect(), t=document.querySelector('#tabs').getBoundingClientRect(); window.scrollTo(0, document.body.scrollHeight); const f2=document.querySelector('.firma').getBoundingClientRect(); return f2.bottom <= t.top + 1})()`));
await ev(`window.scrollTo(0, document.body.scrollHeight)`);
await foto("10_firma_final", 844);
await ev(`window.scrollTo(0,0)`);
await foto("1_semana_vacia", 1500);

// --- armar a mano: lunes / desayuno
await clic(`.fila[data-dia="lunes"][data-com="desayuno"]`);
ok("abre el editor del desayuno", await esperar(`document.querySelector('#editor').open && document.querySelector('#editor h2')?.textContent.includes('Lunes')`));
await clic(`#editor [data-acc="agregar"][data-campo="platos"]`);
ok("lista de platos de desayuno", await esperar(`document.querySelectorAll('#lista-pick .plato').length > 20`));
await ev(`(()=>{const q=document.querySelector('#q-pick'); q.value='ATUN'; q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await esperar(`document.querySelectorAll('#lista-pick .plato').length > 0 && document.querySelectorAll('#lista-pick .plato').length < 12`);
await foto("2_elegir_busqueda");
ok("busca 'ATUN' sin importar mayúsculas/tildes", (await ev(`[...document.querySelectorAll('#lista-pick .nombre')].every(n=>/at[uú]n/i.test(n.textContent))`)));
await clic(`#lista-pick .plato`);
ok("el plato queda elegido", await esperar(`document.querySelectorAll('#editor .sel').length === 1`));
// bebida
await clic(`#editor [data-acc="agregar"][data-campo="bebidas"]`);
await esperar(`document.querySelectorAll('#lista-pick .plato').length > 5`);
await clic(`#lista-pick .plato`);
await esperar(`document.querySelectorAll('#editor .sel').length === 2`);
await foto("3_editor_desayuno");
// plato propio en el almuerzo
await clic(`#editor [data-acc="cerrar-ed"]`);
await clic(`.fila[data-dia="lunes"][data-com="almuerzo"]`);
await clic(`#editor [data-acc="agregar"][data-campo="platos"]`);
await clic(`#editor [data-acc="nuevo"]`);
await esperar(`!!document.querySelector('#nuevo-nombre')`);
await ev(`document.querySelector('#nuevo-nombre').value='Arroz con leche casero'; document.querySelector('#nuevo-ing').value='arroz, leche, canela'`);
await clic(`#editor [data-acc="guardar-nuevo"]`);
ok("crea 'mi propio plato' y lo elige", await esperar(`[...document.querySelectorAll('#editor .sel')].some(s=>s.textContent.includes('Arroz con leche casero'))`));
await clic(`#editor [data-acc="cerrar-ed"]`);
ok("la semana muestra lo elegido", await esperar(`document.querySelector('.dia').textContent.includes('Arroz con leche casero')`));

// --- cena de apoyo
await clic(`.fila[data-dia="martes"][data-com="cena"]`);
await esperar(`document.querySelector('#editor h2')?.textContent.includes('Cena')`);
await clic(`#editor [data-acc="apoyo"][data-id="c01"]`);
await esperar(`document.querySelector('#editor .plato.on')?.textContent.includes('papaya')`);
await clic(`#editor [data-acc="cerrar-ed"]`);
ok("cena de apoyo se ve en el martes", (await ev(`document.querySelectorAll('.dia')[1].textContent.includes('papaya')`)));

// --- plantilla (pide confirmar porque ya hay datos: se acepta)
await ev(`window.confirm = () => true;`);
await clic(`.sem-mas`);
await esperar(`document.querySelector('#editor h2')?.textContent.includes('Más opciones')`);
await clic(`#editor [data-acc="plantillas"]`);
await esperar(`document.querySelectorAll('#editor [data-acc="usar-plantilla"]').length >= 10`);
await foto("4_plantillas");
await clic(`#editor [data-acc="usar-plantilla"][data-id="P01"]`);
ok("cargó la plantilla P01", await esperar(`document.querySelector('.dia').textContent.includes('Omelet de zanahoria con atún y palta')`));
await clic(`#editor [data-acc="refrescos"]`);
ok("sugerir refrescos del almuerzo avisa que llenó los vacíos", await esperar(`document.querySelector('#editor .aviso.ok')?.textContent.includes('refresco')`));
await clic(`#editor [data-acc="cerrar-ed"]`);
await ev(`document.querySelector('.resumen').open = true`);
await foto("5_semana_llena", 2000);
ok("hay 4 filas de resumen", (await ev(`document.querySelectorAll('.resumen li').length`)) === 4);

// --- persistencia: recargar
await enviar("Page.reload");
ok("tras recargar sigue la plantilla", await esperar(`document.querySelector('.dia') && document.querySelector('.dia').textContent.includes('Omelet de zanahoria con atún y palta')`));
// --- el plato propio aparece en Platos
await clic(`.tab[data-tab="platos"]`);
await esperar(`!!document.querySelector('#q')`);
await ev(`(()=>{const q=document.querySelector('#q'); q.value='arroz con leche casero'; q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
ok("el plato propio aparece en Platos con etiqueta 'tuyo'", await esperar(`document.querySelector('#lista .plato')?.textContent.includes('tuyo')`));
await clic(`#lista .plato`);
await esperar(`document.querySelector('#detalle').open`);
ok("detalle de plato propio dice 'Sin ingredientes todavía'", (await ev(`document.querySelector('#detalle').textContent.includes('Sin ingredientes todavía')`)));
await foto("6_detalle_propio");
// --- semana siguiente
await clic(`#cerrar`); await clic(`.tab[data-tab="semana"]`);
await esperar(`!!document.querySelector('.sem-barra')`);
const antes = await ev(`document.querySelector('.sem-titulo strong').textContent`);
await clic(`[data-acc="sem-sig"]`);
await esperar(`document.querySelector('.sem-titulo strong').textContent !== ${JSON.stringify(antes)}`);
ok("avanza a la semana siguiente (vacía)", (await ev(`!document.querySelector('.dia').textContent.includes('Omelet')`)));
await clic(`[data-acc="sem-ant"]`);
ok("vuelve y conserva lo guardado", await esperar(`document.querySelector('.dia').textContent.includes('Omelet de zanahoria con atún y palta')`));

// =================== FASE 6: COMPARTIR ===================
await clic(`[data-sh="abrir"][data-que="menu"]`);
ok("abre 'Compartir' desde Semana, con el menú", await esperar(`document.querySelector('#compartir').open && document.querySelector('#sh-texto')?.value.includes('MENÚ DE LA SEMANA')`));
ok("el texto trae los platos de la plantilla P01", await ev(`document.querySelector('#sh-texto').value.includes('Omelet de zanahoria con atún y palta')`));
await ev(`window.__copiado = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiado = t; } }, configurable: true })`);
await clic(`[data-sh="copiar"]`);
ok("Copiar texto copia exactamente lo que se ve y avisa", await esperar(`window.__copiado && window.__copiado === document.querySelector('#sh-texto').value && document.querySelector('#sh-msg').textContent.includes('Copiado')`));
await ev(`window.__abierto = null; window.open = (u) => { window.__abierto = u; return null; }`);
await clic(`[data-sh="whatsapp"]`);
ok("WhatsApp abre wa.me con el texto codificado", await esperar(`window.__abierto && window.__abierto.startsWith('https://wa.me/?text=') && decodeURIComponent(window.__abierto.slice('https://wa.me/?text='.length)) === document.querySelector('#sh-texto').value`));
await clic(`[data-sh="que"][data-v="compras"]`);
ok("cambia a la lista de compras", await esperar(`document.querySelector('#sh-texto').value.includes('LISTA DE COMPRAS') && document.querySelector('#sh-texto').value.includes('*VERDURAS*')`));
await clic(`[data-sh="que"][data-v="dia"]`);
ok("la hoja del día ofrece los 5 días", await esperar(`document.querySelectorAll('[data-sh="dia"]').length === 5 && document.querySelector('#sh-texto').value.includes('HOJA DEL DÍA')`));
await clic(`[data-sh="dia"][data-v="miercoles"]`);
ok("hoja del miércoles", await esperar(`document.querySelector('#sh-texto').value.includes('MIÉRCOLES')`));
await foto("13_compartir", 900);
await ev(`window.__print = 0; window.print = () => { window.__print++; }`);
await clic(`[data-sh="pdf"]`);
ok("PDF: llama a imprimir con el documento armado y la firma", await esperar(`window.__print === 1 && !!document.querySelector('#impresion .doc') && document.querySelector('#impresion .firma')?.textContent.includes('Cel. 965754455')`));
await enviar("Emulation.setEmulatedMedia", { media: "print" });
ok("PDF: en la impresión la firma del documento está visible, una sola vez y sin animación", await ev(`(()=>{const v=[...document.querySelectorAll('.firma')].filter(f=>getComputedStyle(f).display!=='none' && f.getClientRects().length>0); return v.length===1 && v[0].closest('#impresion') && getComputedStyle(v[0].querySelector('img')).animationName==='none' && getComputedStyle(document.querySelector('#impresion')).display==='block'})()`));
await enviar("Emulation.setEmulatedMedia", { media: "" });
ok("PDF: el título de la página queda como nombre de archivo", (await ev(`document.title`)).includes('Hoja del día'));
for (const que of ["menu", "compras", "dia"]) {
  await ev(`document.querySelector('[data-sh="que"][data-v="${que}"]').click()`); await dormir(250);
  await ev(`document.querySelector('[data-sh="pdf"]').click()`); await dormir(700);
  const r = await enviar("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
  if (r.result?.data) writeFileSync(`${OUT}\\${que}.pdf`, Buffer.from(r.result.data, "base64"));
  ok(`PDF real generado por el navegador: ${que}.pdf`, !!r.result?.data && r.result.data.length > 3000);
}
await ev(`window.dispatchEvent(new Event('afterprint'))`);
ok("al terminar de imprimir se limpia el documento y vuelve el título", await ev(`document.querySelector('#impresion').innerHTML === '' && document.title === 'Menú de casa'`));
await clic(`[data-sh="cerrar"]`);
await clic(`.tab[data-tab="compras"]`); await esperar(`!!document.querySelector('.comp-cab')`);
await clic(`[data-sh="abrir"][data-que="compras"]`);
ok("Compartir también se abre desde Compras, ya en 'Lista de compras'", await esperar(`document.querySelector('#compartir').open && document.querySelector('#sh-texto').value.includes('LISTA DE COMPRAS')`));
await clic(`[data-sh="cerrar"]`);
await clic(`.tab[data-tab="semana"]`); await esperar(`!!document.querySelector('.sem-barra')`);
// =================== COMPRAS ===================
await clic(`.tab[data-tab="compras"]`);
ok("abre Compras con la lista", await esperar(`document.querySelectorAll('.grupo').length >= 4`));
await foto("7_compras", 2200);
const txt = () => ev(`[...document.querySelectorAll('.item .cant')].map(e=>e.textContent).join('|')`);
const con4 = await txt();
ok("por defecto son 4 personas", await ev(`document.querySelector('.pers .chip.on').textContent.trim() === '4'`));
await clic(`.pers .chip[data-n="3"]`);
await esperar(`document.querySelector('.pers .chip.on').textContent.trim() === '3'`);
ok("pasar a 3 personas recalcula las cantidades", (await txt()) !== con4);
await clic(`.pers .chip[data-n="4"]`);
await esperar(`document.querySelector('.pers .chip.on').textContent.trim() === '4'`);
ok("volver a 4 devuelve las cantidades", (await txt()) === con4);

const total0 = await ev(`document.querySelectorAll('.grupo .item').length`);
await clic(`.grupo .item input[type="checkbox"]`);
ok("marcar 'ya compré' tacha el renglón y cuenta", await esperar(`document.querySelectorAll('.item.hecho').length === 1 && document.querySelector('.progreso span').textContent.includes('Comprado 1 de')`));
const nombreTengo = await ev(`document.querySelectorAll('.grupo .item:not(.hecho) .nom b')[0].textContent`);
await clic(`.grupo .item:not(.hecho) button.tengo`);
ok("'ya tengo' saca el ingrediente de la lista", await esperar(`[...document.querySelectorAll('details.extra summary')].some(s=>s.textContent.includes('Ya tengo en casa (1)')) && document.querySelectorAll('.grupo .item').length === ${total0} - 1`));
// básicos: abrir, marcar uno y comprobar que la sección no se cierra
await ev(`[...document.querySelectorAll('details.extra')].find(d=>d.textContent.includes('Básicos de la semana')).open = true`);
await ev(`document.querySelector('input[data-ac="basico-falta"]').click()`);
ok("marcar un básico que falta lo agrega a la lista", await esperar(`[...document.querySelectorAll('.grupo h3')].some(h=>h.textContent.trim()==='Básicos')`));
ok("la sección de básicos sigue abierta", (await ev(`[...document.querySelectorAll('details.extra')].find(d=>d.textContent.includes('Básicos de la semana')).open`)));
await foto("8_compras_abajo", 2400);
// persistencia
await enviar("Page.reload");
await esperar(`document.querySelector('.comp-cab')`);
ok("tras recargar: sigue 4 personas, 1 comprado y 1 ya tengo", await esperar(`document.querySelector('.pers .chip.on').textContent.trim()==='4' && document.querySelectorAll('.item.hecho').length>=1 && [...document.querySelectorAll('details.extra summary')].some(s=>s.textContent.includes('Ya tengo en casa (1)'))`));
await ev(`[...document.querySelectorAll('details.extra')].find(d=>d.textContent.includes('Ya tengo en casa')).open = true`);
await clic(`[data-ac="quitar-tengo"]`);
ok("'volver a la lista' devuelve el ingrediente", await esperar(`document.querySelectorAll('.grupo .item').length >= ${total0}`));
// semana vacía => aviso de que no hay nada que comprar
await clic(`.tab[data-tab="semana"]`);
await esperar(`!!document.querySelector('.sem-barra')`);
await clic(`[data-acc="sem-sig"]`); await clic(`[data-acc="sem-sig"]`);
await clic(`.tab[data-tab="compras"]`);
ok("una semana vacía muestra 'Todavía no hay nada que comprar'", await esperar(`document.querySelector('.vacio h2')?.textContent.includes('nada que comprar')`));

// =================== FASE 5: PLATOS PROPIOS Y COPIA DE SEGURIDAD ===================
await ev(`window.confirm = () => true;`);
const poner = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const buscarPlato = async (texto) => { await poner('#q', texto); await esperar(`document.querySelectorAll('#lista .plato').length >= 1`); };
await clic(`.tab[data-tab="platos"]`);
await esperar(`!!document.querySelector('[data-ap="nuevo"]')`);
ok("Platos tiene 'Nuevo plato' y 'Copia de seguridad'", await ev(`!!document.querySelector('[data-ap="nuevo"]') && !!document.querySelector('[data-ap="respaldo"]')`));

// validación: sin nombre no deja guardar
await clic(`[data-ap="nuevo"]`);
ok("abre el formulario de plato nuevo", await esperar(`document.querySelector('#formulario').open && document.querySelector('#formulario h2')?.textContent==='Nuevo plato'`));
await clic(`[data-ap="guardar"]`);
ok("sin nombre muestra el error y no guarda", await esperar(`document.querySelector('#formulario .errores')?.textContent.includes('Escribe el nombre')`));

// crear plato con un ingrediente del catálogo y uno nuevo
await poner('#f-nombre', 'Rocoto relleno casero');
await clic(`[data-ap="ing-agregar"]`);
await esperar(`!!document.querySelector('#q-ing')`);
await poner('#q-ing', 'carne molida');
await esperar(`document.querySelectorAll('#lista-ing .plato').length === 1`);
await clic(`#lista-ing .plato`);
await esperar(`document.querySelectorAll('#formulario .ing-fila').length === 1`);
await poner('#formulario .ing-fila .cant-in', '80');
await clic(`[data-ap="ing-agregar"]`);
await esperar(`!!document.querySelector('[data-ap="ing-nuevo"]')`);
await clic(`[data-ap="ing-nuevo"]`);
await esperar(`!!document.querySelector('#n-nombre')`);
await poner('#n-nombre', 'Rocoto');
await clic(`[data-ap="ing-nuevo-guardar"]`);
ok("crea un ingrediente nuevo y lo agrega al plato", await esperar(`document.querySelectorAll('#formulario .ing-fila').length === 2 && document.activeElement?.classList.contains('cant-in')`));
ok("al volver conserva lo ya escrito (nombre y cantidad)", await ev(`document.querySelector('#f-nombre').value==='Rocoto relleno casero' && document.querySelectorAll('#formulario .cant-in')[0].value==='80'`));
await clic(`[data-ap="guardar"]`);
ok("sin cantidad en un ingrediente no deja guardar", await esperar(`document.querySelector('#formulario .errores')?.textContent.includes('Falta la cantidad de “Rocoto”')`));
await ev(`document.querySelectorAll('#formulario .cant-in')[1].value = '100'`);
await ev(`document.querySelector('#m-verdura').checked = true`);
await foto("11_form_plato", 1300);
await clic(`[data-ap="guardar"]`);
ok("guarda el plato propio y cierra el formulario", await esperar(`!document.querySelector('#formulario').open`));
await buscarPlato('rocoto relleno');
ok("el plato aparece en la lista con la etiqueta 'tuyo'", await esperar(`document.querySelector('#lista .plato')?.textContent.includes('Rocoto relleno casero') && document.querySelector('#lista .plato').textContent.includes('tuyo')`));
await clic(`#lista .plato`);
await esperar(`document.querySelector('#detalle').open`);
ok("el detalle muestra sus ingredientes con cantidad y las acciones Editar/Eliminar", await ev(`(()=>{const t=document.querySelector('#detalle').textContent; return t.includes('Rocoto') && t.includes('100 g') && t.includes('Carne molida') && t.includes('80 g') && !!document.querySelector('#detalle [data-ap="editar"]') && !!document.querySelector('#detalle [data-ap="eliminar"]')})()`));
await clic(`#cerrar`);

// usarlo en la semana y ver que SUMA a las compras
await clic(`.tab[data-tab="semana"]`);
await esperar(`!!document.querySelector('.sem-barra')`);
await clic(`.fila[data-dia="lunes"][data-com="almuerzo"]`);
await clic(`#editor [data-acc="agregar"][data-campo="platos"]`);
await esperar(`!!document.querySelector('#q-pick')`);
await poner('#q-pick', 'rocoto relleno');
await esperar(`document.querySelectorAll('#lista-pick .plato').length === 1`);
await clic(`#lista-pick .plato`);
await esperar(`document.querySelectorAll('#editor .sel').length === 1`);
await clic(`#editor [data-acc="cerrar-ed"]`);
await clic(`.tab[data-tab="compras"]`);
await esperar(`!!document.querySelector('.comp-cab')`);
const cant = (n) => ev(`(()=>{const it=[...document.querySelectorAll('.grupo .item')].find(i=>i.querySelector('.nom b').textContent.trim()===${JSON.stringify(n)}); return it ? it.querySelector('.cant').textContent.trim() : null})()`);
ok("Compras suma el ingrediente propio: Rocoto 100 g x 8 = 800 g", (await cant('Rocoto')) === '800 g');
ok("Compras suma el del catálogo: Carne molida 80 g x 8 = 650 g", (await cant('Carne molida')) === '650 g');
ok("ya no avisa 'falta agregar los ingredientes'", await ev(`!document.querySelector('.comp-cab').parentElement.textContent.includes('Falta agregar los ingredientes de “Rocoto')`));
ok("el ingrediente nuevo cae en su grupo (Verduras)", await ev(`[...document.querySelectorAll('.grupo')].find(g=>g.querySelector('h3').textContent.trim().toLowerCase()==='verduras')?.textContent.includes('Rocoto')`));

// editar
await clic(`.tab[data-tab="platos"]`); await esperar(`!!document.querySelector('#q')`);
await buscarPlato('rocoto relleno'); await clic(`#lista .plato`); await esperar(`document.querySelector('#detalle').open`);
await clic(`#detalle [data-ap="editar"]`);
ok("Editar abre el formulario con lo guardado", await esperar(`document.querySelector('#formulario').open && document.querySelector('#formulario h2')?.textContent==='Editar plato' && document.querySelector('#f-nombre').value==='Rocoto relleno casero' && document.querySelectorAll('#formulario .ing-fila').length===2`));
await poner('#f-nombre', 'Rocoto relleno de la casa');
await clic(`[data-ap="guardar"]`);
await esperar(`!document.querySelector('#formulario').open`);
await buscarPlato('rocoto relleno');
ok("editar cambia el nombre y no duplica el plato", (await ev(`[...document.querySelectorAll('#lista .nombre')].map(n=>n.textContent).join('|')`)) === 'Rocoto relleno de la casa');

// duplicar uno del catálogo
await buscarPlato('Ají de gallina'); await clic(`#lista .plato`); await esperar(`document.querySelector('#detalle').open`);
ok("un plato del catálogo ofrece 'Duplicar y editar' (no se edita el original)", await ev(`!!document.querySelector('#detalle [data-ap="editar"]') && !document.querySelector('#detalle [data-ap="eliminar"]')`));
await clic(`#detalle [data-ap="editar"]`);
ok("la copia trae nombre '(mío)' y los ingredientes del original", await esperar(`document.querySelector('#f-nombre')?.value==='Ají de gallina (mío)' && document.querySelectorAll('#formulario .ing-fila').length >= 5`));
await clic(`[data-ap="guardar"]`); await esperar(`!document.querySelector('#formulario').open`);
await buscarPlato('Ají de gallina');
ok("quedan el original y la copia", (await ev(`document.querySelectorAll('#lista .plato').length`)) === 2);
// eliminar la copia
await ev(`window.confirm = () => true;`);
await ev(`[...document.querySelectorAll('#lista .plato')].find(p=>p.textContent.includes('(mío)')).click()`);
await esperar(`document.querySelector('#detalle').open`);
await clic(`#detalle [data-ap="eliminar"]`);
ok("eliminar quita solo la copia", await esperar(`document.querySelectorAll('#lista .plato').length === 1 && !document.querySelector('#lista').textContent.includes('(mío)')`));

// ---- copia de seguridad: exportar
await clic(`[data-ap="respaldo"]`);
ok("abre la copia de seguridad con el resumen", await esperar(`document.querySelector('#formulario').open && document.querySelector('#formulario').textContent.includes('Todavía no has guardado ninguna copia')`));
await ev(`window.__blob = null; URL.createObjectURL = (b) => { window.__blob = b; return 'blob:prueba'; }; HTMLAnchorElement.prototype.click = function(){ window.__descarga = this.download; };`);
await clic(`[data-ap="exportar"]`);
ok("exportar genera el archivo con nombre con fecha", await esperar(`!!window.__blob && /^menu-de-casa-\\d{4}-\\d{2}-\\d{2}\\.json$/.test(window.__descarga||'')`));
const copia = await ev(`window.__blob.text()`);
const cj = JSON.parse(copia);
ok("la copia contiene app, versión, el plato propio, el ingrediente propio y semanas", cj.app === 'menu-de-casa' && cj.version === 1 && cj.platos_usuario.some(p=>p.nombre==='Rocoto relleno de la casa') && cj.ingredientes_usuario.some(g=>g.id==='x_rocoto') && cj.semanas.length >= 1 && cj.ajustes.personas === 4);
ok("la fecha de la copia y del archivo es la LOCAL (no la de UTC)", cj.fecha === await ev(`new Date().toLocaleDateString('en-CA')`) && (await ev(`window.__descarga`)).includes(cj.fecha));
ok("la copia NO incluye los platos del catálogo", !cj.platos_usuario.some(p=>p.id==='A04'));
ok("tras exportar muestra la fecha de la última copia", await esperar(`document.querySelector('#formulario').textContent.includes('Última copia:')`));
await clic(`[data-ap="cerrar-form"]`);

// ---- borrar el plato y restaurar desde la copia
await buscarPlato('rocoto relleno'); await clic(`#lista .plato`); await esperar(`document.querySelector('#detalle').open`);
await clic(`#detalle [data-ap="eliminar"]`);
ok("se borró el plato propio (y se quitó de la semana)", await esperar(`document.querySelectorAll('#lista .plato').length === 0`));
await clic(`[data-ap="respaldo"]`); await esperar(`!!document.querySelector('#archivo-respaldo')`);
const subir = (texto, nombre = 'copia.json') => ev(`(()=>{const dt=new DataTransfer(); dt.items.add(new File([${JSON.stringify(texto)}],${JSON.stringify(nombre)},{type:'application/json'})); const i=document.querySelector('#archivo-respaldo'); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await subir('{"hola": 1}');
ok("un archivo que no es una copia se rechaza con un mensaje claro", await esperar(`document.querySelector('#formulario .errores')?.textContent.includes('no es una copia')`));
await subir('esto no es json');
ok("un archivo que no es JSON se rechaza", await esperar(`document.querySelector('#formulario .errores')?.textContent.includes('No pude leer')`));
const rota = JSON.parse(copia); rota.platos_usuario.find((p) => p.ingredientes.length).ingredientes[0].cant = -1;
await subir(JSON.stringify(rota));
ok("una copia con datos corruptos se rechaza", await esperar(`document.querySelector('#formulario .errores')?.textContent.includes('inválido')`));
await subir(copia);
ok("una copia válida pide confirmación y muestra qué trae", await esperar(`document.querySelector('#formulario h2')?.textContent==='Restaurar copia' && document.querySelector('#formulario').textContent.includes(${cj.platos_usuario.length} + ' plato(s) tuyo(s)')`));
await foto("12_restaurar", 700);
await clic(`[data-ap="restaurar-ok"]`);
await dormir(1500);
ok("restaura y recarga la app", await esperar(`!!document.querySelector('#q')`, 15000));
await buscarPlato('rocoto relleno');
ok("el plato restaurado está en la lista con 'tuyo'", await esperar(`document.querySelector('#lista .plato')?.textContent.includes('Rocoto relleno de la casa')`));
await clic(`#lista .plato`); await esperar(`document.querySelector('#detalle').open`);
ok("sus ingredientes (incluido el propio) volvieron", await ev(`document.querySelector('#detalle').textContent.includes('Rocoto') && document.querySelector('#detalle').textContent.includes('100 g')`));
await clic(`#cerrar`);

// =================== FASE 7: ¿QUÉ COCINO? ===================
const sim = spawn(process.execPath, [join(dirname(process.argv[1]), "worker_simulado.mjs"), "8770"], { stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { if ((await fetch("http://127.0.0.1:8770/__ultimo")).ok) break; } catch {} await dormir(250); }
const ctl = (ruta) => fetch("http://127.0.0.1:8770" + ruta).then((r) => r.json());
const simulado = (await ctl("/__ultimo").catch(() => null)) !== null;
ok("el servicio de fotos simulado (código real del intermediario) está activo", simulado);

await clic(`.tab[data-tab="cocino"]`);
ok("abre ¿Qué cocino?", await esperar(`!!document.querySelector('.cocino')`));
ok("empieza vacío y pide marcar insumos", await ev(`document.querySelector('.cocino').textContent.includes('Todavía no marcaste nada') && document.querySelector('.cocino').textContent.includes('Marca lo que tienes')`));

// ---- a mano (funciona sin servicio y sin internet)
await clic(`[data-ck="agregar"]`);
await esperar(`document.querySelector('#cocino-dlg').open`);
await poner('#ck-q', 'pollo');
await esperar(`!!document.querySelector('#cocino-dlg [data-ck="alternar"][data-id="pollo"]')`);
await clic(`#cocino-dlg [data-ck="alternar"][data-id="pollo"]`);
await clic(`[data-ck="listo"]`);
ok("marcar un insumo a mano lo agrega a 'Lo que tengo'", await esperar(`document.querySelectorAll('.cocino .sels .sel').length === 1 && document.querySelector('.cocino .sels').textContent.includes('Pollo')`));
ok("con solo pollo aparecen platos 'te falta poco' y ninguno 'listo'", await ev(`(()=>{const t=document.querySelector('.cocino').textContent; return t.includes('Puedes cocinar ya (0)') && !t.includes('Te falta poco (0)')})()`));

// ---- foto sin configurar el servicio
await ev(`new Promise((r) => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#b33'; x.fillRect(0, 0, 1600, 1200); x.fillStyle = '#fc0'; x.fillRect(200, 200, 600, 600); c.toBlob((b) => { window.__foto = new File([b], 'foto.jpg', { type: 'image/jpeg' }); r(1); }, 'image/jpeg', 0.9); })`);
const subirFoto = () => ev(`(()=>{ const dt = new DataTransfer(); dt.items.add(window.__foto); const i = document.querySelector('#ck-archivo'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await subirFoto();
ok("al elegir una foto aparece su miniatura y el botón de reconocer", await esperar(`document.querySelectorAll('.ck-foto').length === 1 && !!document.querySelector('[data-ck="reconocer"]')`));
await clic(`[data-ck="reconocer"]`);
ok("sin configurar el servicio avisa qué falta (y abre la configuración)", await esperar(`document.querySelector('#ck-msg').textContent.includes('Primero escribe la dirección') && document.querySelector('#ck-cfg').open`));

// ---- configurar y probar la conexión
await poner('#ck-url', 'http://mi-servicio.workers.dev');
await clic(`[data-ck="cfg-guardar"]`);
ok("una dirección http por internet se rechaza (el código de acceso no viajaría cifrado)", await esperar(`document.querySelector('#ck-msg-cfg').textContent.includes('https://')`));
await poner('#ck-url', 'http://127.0.0.1:8770'); await poner('#ck-token', 'sk-ant-api03-ESTA-CLAVE-NO-DEBE-GUARDARSE-1234');
await clic(`[data-ck="cfg-guardar"]`);
ok("una clave de API pegada en el código de acceso se RECHAZA con una explicación clara", await esperar(`document.querySelector('#ck-msg-cfg').textContent.includes('CLAVE DE API') && document.querySelector('#ck-msg-cfg').textContent.includes('Cloudflare')`));
ok("la clave se borra del campo y NO queda guardada en el teléfono", await ev(`document.querySelector('#ck-token').value === ''`) && !(await ev(`import('./src/db.js').then(async (m) => JSON.stringify(await m.ajuste('foto_token', '')))`)).includes('sk-ant'));
ok("el campo explica que el código lo inventas tú y que NO es la clave de API", await ev(`document.querySelector('#ck-ayuda-token').textContent.includes('tú inventas') && document.querySelector('#ck-ayuda-token').textContent.includes('No es tu clave de API')`));
await poner('#ck-url', 'http://127.0.0.1:8770'); await poner('#ck-token', 'codigo-equivocado');
await clic(`[data-ck="cfg-probar"]`);
ok("un código de acceso equivocado se avisa con claridad", await esperar(`document.querySelector('#ck-msg-cfg').textContent.includes('código de acceso no es correcto')`));
await poner('#ck-token', 'prueba123');
await clic(`[data-ck="cfg-guardar"]`);
ok("guarda la conexión", await esperar(`document.querySelector('#ck-msg-cfg').textContent.includes('Guardado')`));
await clic(`[data-ck="cfg-probar"]`);
ok("probar conexión: conectado, con modelo y gasto del mes", await esperar(`document.querySelector('#ck-msg-cfg').textContent.includes('Conectado') && document.querySelector('#ck-msg-cfg').textContent.includes('claude-opus-5-5') && document.querySelector('#ck-msg-cfg').textContent.includes('$0.00 de $2.00')`));

// ---- reconocer la foto (servicio simulado con el código real del intermediario)
await clic(`[data-ck="reconocer"]`);
ok("reconocer: agrega los insumos detectados (solo los que existen en la app)", await esperar(`(()=>{const t=document.querySelector('.cocino .sels').textContent; return ['Pollo','Papa blanca','Cebolla roja','Ají amarillo','Pan de molde','Leche evaporada','Queso parmesano'].every(n=>t.includes(n)) && document.querySelectorAll('.cocino .sels .sel').length === 7})()`, 15000));
ok("avisa cuántos encontró y que hay que revisar", await ev(`document.querySelector('#ck-msg').textContent.includes('Encontré 7') && document.querySelector('#ck-msg').textContent.includes('Revisa')`));
ok("lo que no está en el catálogo se muestra aparte ('rocoto')", await ev(`document.querySelector('.cocino').textContent.includes('rocoto')`));
ok("el Ají de gallina aparece en 'Puedes cocinar ya' con '¡Tienes todo!'", await ev(`(()=>{const li=[...document.querySelectorAll('.cocino .lista .plato')].find(p=>p.querySelector('.nombre').textContent==='Ají de gallina'); return !!li && li.textContent.includes('¡Tienes todo!')})()`));
const u = await ctl("/__ultimo");
ok("el servicio recibió 1 foto JPEG reducida (menos de ~550 KB) y el catálogo de la app", u.imagenes === 1 && u.media_type === "image/jpeg" && u.bytes_b64 < 750000 && u.catalogo > 80);
ok("el código de acceso NO se mete en el texto que se manda a Claude", u.sistema_incluye_token === false);
await foto("14_cocino", 1900);

// ---- MENÚ DEL DÍA (con IA y sin IA)
await ev(`window.confirm = () => true;`);
ok("la sección 'Menú del día' ofrece los dos caminos: con IA y sin IA", await ev(`!!document.querySelector('[data-ck="menu-ia"]') && !!document.querySelector('[data-ck="menu-local"]') && !document.querySelector('[data-ck="menu-ia"]').disabled`));
await clic(`[data-ck="menu-local"]`);
ok("'Sin IA' arma un menú con desayuno, lonchera y almuerzo, y cena = sobrante", await esperar(`(()=>{const c=document.querySelector('.mn-card'); if(!c) return false; const t=c.textContent; return t.includes('sin IA') && t.includes('Desayuno') && t.includes('Lonchera') && t.includes('Almuerzo') && t.includes('Sobrante del almuerzo')})()`));
ok("muestra qué falta comprar para ese menú (o que no falta nada)", await ev(`document.querySelector('.mn-falta').textContent.includes('Te faltaría comprar') || document.querySelector('.mn-falta').textContent.includes('No te falta nada')`));
const antesLocal = await ev(`document.querySelector('.mn-card .mn-fila b').textContent`);
await clic(`[data-ck="menu-ia"]`);
ok("'Armar menú con IA' pide el menú al servicio y lo muestra como sugerido por IA", await esperar(`(()=>{const c=document.querySelector('.mn-card'); return !!c && c.textContent.includes('sugerido por IA') && c.textContent.includes('Menú simulado de prueba')})()`, 15000));
ok("incluye las ideas extra de la IA", await ev(`document.querySelector('.mn-card').textContent.includes('Un licuado de plátano para la cena')`));
const um = await ctl("/__ultimo");
ok("al servicio le llegaron los insumos, las personas y los platos candidatos con lo que les falta", um.tipo === "menu" && um.texto.includes("INSUMOS QUE TIENEN:") && um.texto.includes("Pollo") && um.texto.includes("PERSONAS: 4") && um.texto.includes("A04 | Ají de gallina | falta: nada") && um.texto.includes("REFRESCOS:"));
ok("el pedido de menú NO incluye fotos ni el código de acceso", !um.texto.includes("prueba123") && !um.texto.includes("base64"));
ok("el menú de la IA trae un plato real del catálogo (se puede abrir su detalle)", await ev(`!!document.querySelector('.mn-card .mn-fila[data-id]')`));
await foto("15_menu_dia", 2300);
await clic(`[data-ck="menu-otro"]`);
ok("'Otro menú' pide uno nuevo diciéndole a la IA qué platos evitar", await esperar(`document.querySelector('.mn-card') !== null`) && (await dormir(600), (await ctl("/__ultimo")).texto.includes("EVITAR: ") && !(await ctl("/__ultimo")).texto.includes("EVITAR: (ninguno)")));
// poner el menú en la semana
await clic(`[data-ck="dia"][data-v="miercoles"]`);
ok("se elige el día de la semana", await esperar(`document.querySelector('.mn-card .chip.on').textContent.trim()==='Mié'`));
const nombreAlm = await ev(`document.querySelectorAll('.mn-card .mn-fila b')[2]?.textContent || document.querySelectorAll('.mn-card .mn-fila b')[0].textContent`);
await clic(`[data-ck="poner-semana"]`);
ok("'Poner en mi semana' confirma en qué día y semana lo puso", await esperar(`document.querySelector('#ck-msg-menu').textContent.includes('puse el menú en el miércoles')`));
await clic(`.tab[data-tab="semana"]`); await esperar(`!!document.querySelector('.sem-barra')`);
ok("en la pestaña Semana, el miércoles ya tiene las comidas del menú", await ev(`(()=>{const d=[...document.querySelectorAll('.dia')].find(x=>x.querySelector('h3').textContent.trim()==='Miércoles'); return !!d && d.textContent.includes(${JSON.stringify(nombreAlm)})})()`));
await clic(`.tab[data-tab="cocino"]`); await esperar(`!!document.querySelector('.cocino')`);
// al cambiar los insumos el menú anterior se descarta
await ev(`[...document.querySelectorAll('.cocino .sels .sel')][0].querySelector('button').click()`);
ok("al cambiar los insumos el menú anterior desaparece (ya no corresponde)", await esperar(`!document.querySelector('.mn-card')`));
// se vuelve a agregar el insumo quitado para no alterar las comprobaciones siguientes
await clic(`[data-ck="agregar"]`); await esperar(`document.querySelector('#cocino-dlg').open`);
await poner('#ck-q', 'pollo'); await esperar(`!!document.querySelector('#cocino-dlg [data-ck="alternar"][data-id="pollo"]')`);
await clic(`#cocino-dlg [data-ck="alternar"][data-id="pollo"]`); await clic(`[data-ck="listo"]`);
await esperar(`document.querySelectorAll('.cocino .sels .sel').length === 7`);
// tope de gasto en el menú: sugiere el camino sin IA
await ctl("/__gasto?v=1.99");
await clic(`[data-ck="menu-ia"]`);
ok("si se llegó al tope de gasto, el menú con IA lo explica y sugiere 'Sin IA'", await esperar(`document.querySelector('#ck-msg-menu').textContent.includes('tope de gasto del mes') && document.querySelector('#ck-msg-menu').textContent.includes('Sin IA')`));
await ctl("/__gasto?v=0");
await clic(`[data-ck="menu-local"]`);
ok("aunque haya tope, 'Sin IA' sigue funcionando", await esperar(`!!document.querySelector('.mn-card') && document.querySelector('.mn-card').textContent.includes('sin IA')`));

// ---- tope de gasto
await ctl("/__gasto?v=1.99");
await clic(`[data-ck="reconocer"]`);
ok("al llegar al tope de gasto lo explica y sugiere marcar a mano", await esperar(`document.querySelector('#ck-msg').textContent.includes('tope de gasto del mes') && document.querySelector('#ck-msg').textContent.includes('$1.99 de $2.00')`));
await ctl("/__gasto?v=0");

// ---- resultados: cambiar de categoría y abrir el detalle de un plato
await clic(`[data-ck="cat"][data-v="desayuno"]`);
ok("cambiar a Desayunos recalcula la lista", await esperar(`document.querySelector('.cocino [aria-label="Tipo de comida"] .chip.on').textContent.trim()==='Desayunos'`));
await clic(`[data-ck="cat"][data-v="almuerzo"]`);
await esperar(`!!document.querySelector('.cocino .lista .plato')`);
await clic(`.cocino .lista .plato`);
ok("tocar un plato abre su detalle", await esperar(`document.querySelector('#detalle').open`));
await clic(`#cerrar`);

// ---- 'quitar' un insumo mal detectado cambia los resultados
await ev(`[...document.querySelectorAll('.cocino .sels .sel')].find(s=>s.textContent.includes('Queso parmesano')).querySelector('button').click()`);
ok("quitar un insumo detectado por error actualiza: el Ají de gallina pasa a 'Te falta: Queso parmesano'", await esperar(`(()=>{const li=[...document.querySelectorAll('.cocino .lista .plato')].find(p=>p.querySelector('.nombre').textContent==='Ají de gallina'); return !!li && li.textContent.includes('Te falta: Queso parmesano')})()`));

// ---- lo "ya tengo en casa" de Compras cuenta como existencia
await ev(`import('./src/db.js').then((m) => m.guardarAjuste('despensa', ['arroz', 'huevo']))`); await dormir(300);
await clic(`.tab[data-tab="semana"]`); await esperar(`!!document.querySelector('.sem-barra')`);
await clic(`.tab[data-tab="cocino"]`);
ok("aparece la opción de contar lo que ya tengo en casa (2)", await esperar(`document.querySelector('input[data-ck="despensa"]')?.parentElement.textContent.includes('(2)')`));

// ---- persistencia tras recargar
await enviar("Page.reload");
await esperar(`!!document.querySelector('.cocino')`, 15000);
ok("tras recargar siguen los insumos marcados y la conexión guardada", await esperar(`document.querySelectorAll('.cocino .sels .sel').length === 6`) && await ev(`document.querySelector('#ck-url').value === 'http://127.0.0.1:8770' && document.querySelector('#ck-token').value === 'prueba123'`));
await clic(`[data-ck="limpiar"]`);
ok("'Borrar todo' vacía la lista", await esperar(`document.querySelector('.cocino .sels').textContent.includes('Todavía no marcaste nada')`));
sim.kill();
await clic(`.tab[data-tab="platos"]`); await esperar(`!!document.querySelector('#q')`);

// --- si el logo falla, se muestra el texto "SystemIA"
await ev(`document.querySelector('.firma img').src = 'no_existe_12345.png'`);
ok("firma: si el logo falla muestra el texto 'SystemIA'", await esperar(`!document.querySelector('.firma img') && document.querySelector('.firma-logo').textContent.trim()==='SystemIA'`));
await foto("9_firma_fallback", 900);

console.log(resultados.join("\n"));
console.log(errores.length ? "ERRORES DE JS:\n" + errores.join("\n") : "Sin errores de JavaScript");
ws.close(); edge.kill();
process.exit(0);
