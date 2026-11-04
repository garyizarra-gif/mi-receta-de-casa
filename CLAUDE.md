# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

App NUEVA e INDEPENDIENTE (PWA de recetario familiar, en español) para planificar la comida casera de una familia de 3 a 4 personas con un niño. No tiene relación con el proyecto del megapack de ~1 GB que vive en la carpeta padre (`salida/pwa/`, `pack_original/`, etc.): no leer, reutilizar ni modificar nada de allí. Esta carpeta tendrá su propio repositorio.

**Estado actual: Fases 0 a 6 aprobadas/probadas; Fase 7 (foto de insumos: pestaña ¿Qué cocino? + intermediario `worker/`) construida; falta que el usuario la pruebe y, sobre todo, DESPLIEGUE el intermediario con su clave (único paso que no se pudo probar: la llamada real a Claude).** Con esto el plan de 7 fases queda completo. Siguiente: fase 7 (foto de insumos con Cloudflare Worker). Siguiente: fase 6 (compartir: PDF y texto para WhatsApp) y fase 7 (foto de insumos). Se trabaja por fases y se DETIENE al terminar cada una para que el usuario pruebe y apruebe; no se avanza a la siguiente sin su OK.

Fases: 0 limpieza de menús y platos únicos (hecha, pendiente de aprobación) → 1 catálogo de ingredientes por persona → 2 esqueleto de la PWA → 3 Semana + Resumen → 4 Compras → 5 platos propios y respaldo → 6 compartir (PDF y WhatsApp) → 7 foto de insumos. Antes de la fase 2 hay que mostrar el esquema de datos y esperar aprobación.

## Fuentes de datos (solo lectura, nunca modificar)

- `RECETAS DE LA SEMANA.docx` y `RELACION DE COMIDA PARA COCINAR DE LUNES A VIERNES.pdf` NO son recetas: son menús de WhatsApp (desayuno / lonchera / almuerzo, lunes a viernes). No traen ingredientes, cantidades ni pasos. Hay duplicados, textos cortados y errores de escritura.
- Por eso las cantidades de insumos NO salen de los archivos: el catálogo de ingredientes por persona lo propone Claude como "estimado" y solo cuenta cuando el usuario lo aprueba. Nunca inventar cantidades ni datos nutricionales en silencio.

## Comandos

Python en esta máquina: usar `python -I -X utf8` (`-I` aísla el intérprete; `-X utf8` evita errores de codificación de la consola de Windows con emojis y tildes). Dependencia: `pdfplumber`.

```
python -I -X utf8 scripts/f0_parsear_menus.py   # lee docx+pdf -> datos/menus_crudos.json
python -I -X utf8 scripts/f0_catalogo.py        # -> datos/menus_limpios.json, catalogo_fase0.json, fase0_reporte.md
python -I -X utf8 scripts/f1_ingredientes.py    # -> datos/ingredientes.json, recetas_f1.json, fase1_reporte.md
python -I -X utf8 scripts/f3_plantillas.py      # menus_limpios -> datos/plantillas.json + fase3_plantillas_reporte.md (revisar el reporte)
python -I -X utf8 scripts/f2_preparar_app.py    # copia los datos a app/data/ y genera los iconos (requiere Pillow); correrlo SIEMPRE al final
npm test                                        # node --test: datos de la app + funciones puras (110 pruebas)
node scripts/prueba_ui.mjs <carpeta_salida>     # prueba de interfaz real con Edge por CDP (127 chequeos + capturas y 3 PDF reales; levanta solo el servicio simulado); requiere `npm run servir` activo en 8765
npm run test:worker                             # 25 pruebas del intermediario (worker/), sin red ni clave
node scripts/worker_simulado.mjs 8770           # servicio de fotos SIMULADO: código real del intermediario + Claude de mentira
npm run servir                                  # servidor local en Node (scripts/servir.mjs): http://127.0.0.1:8765
npm run servir:red                              # igual, pero visible desde el celular en la misma Wi-Fi (imprime la direccion)
```

Para correr UN archivo de pruebas: `node --test test/formato.test.mjs`. Si `datos/` cambia, hay que volver a correr `f2_preparar_app.py` (una prueba falla si `app/data/` queda desfasado).

El orden importa: cada script lee la salida del anterior. Todos son idempotentes. `f1_ingredientes.py` falla (exit 1) si un plato del catálogo no tiene receta, si una receta usa un ingrediente que no está en el maestro, o si falta cantidad en un ingrediente que no es básico. `f0_catalogo.py` imprime un control de cobertura (comidas que ningún patrón reconoció y platos con 0 apariciones); revisarlo después de cambiar patrones. Todavía no hay build, lint ni tests; cuando existan las fases de escalado/suma de ingredientes y reglas del resumen, llevarán pruebas automáticas.

## Arquitectura de los datos (Fase 0)

- `scripts/f0_parsear_menus.py` extrae el texto de las dos fuentes, quita los sellos de WhatsApp (`[9:28 p. m., 9/10/2026] Roger Ir:`), detecta cabeceras de día y de comida y une las líneas de continuación. Una comida nueva con la misma clave dentro del mismo menú abre un menú nuevo. Separa la nota "Para mi mamá" a un campo aparte.
- `scripts/f0_catalogo.py` define el catálogo A MANO como listas de platos (`DESAYUNOS`, `DES_BEB`, `ALMUERZOS`, `BOCADOS`, `FRUTAS`, `REFRESCOS`, `CENA`), cada uno con un patrón regex sobre el texto normalizado (minúsculas, sin tildes). Cuenta apariciones sobre los menús útiles (sin duplicados exactos). Para agregar o fusionar un plato se edita su patrón ahí, no los JSON generados.
- Cada plato lleva marcas que alimentan el "Resumen de la semana": `harina` (a=arroz, f=fideo, p=pan, h=panqueque/pizza/crepa), `pescado` (ninguno/visible/camuflado), `menestra`, `verdura`, `camote`, `proteina`.
- Los emojis de semana (🍒🍓🍎🍇🍅🍋🍏) NO identifican semanas de forma única (🍎 agrupa varias); las plantillas de semana se arman por secuencia lunes→viernes, en la fase 3.
- `datos/*.json` y `datos/fase0_reporte.md` son generados; se regeneran con los scripts.

## Arquitectura de los datos (Fase 1)

- `scripts/f1_ingredientes.py` contiene a mano, en un texto compacto (`id cantidad unidad; ...`), el maestro de ingredientes (`MAESTRO`: grupo de compra, unidad de compra, si es básico, peso aproximado por unidad) y las recetas por categoría. Los platos nuevos propuestos (N01–N10: chilcano, pescado camuflado, camote, menestras) están en `NUEVOS` con sus marcas.
- Unidades canónicas: `g`, `ml`, `u`. Un ingrediente sin cantidad es un básico "al gusto" (aceite, sal, ajo, comino, canela, vainilla, orégano).
- La porción base varía por categoría: desayuno/almuerzo = adulto, lonchera = niño, bebida de desayuno = vaso de 250 ml, refresco = 1 litro, licuado = 1 jarra (~1 L, 1 huevo). El almuerzo NO incluye arroz/papa/ensalada salvo que el nombre del plato lo diga: esos son "acompañamientos" (AC01–AC12) que se eligen aparte, y la harina del arroz cuenta en el resumen semanal vía el acompañamiento.
- Todas las recetas salen con `estado: "estimado"`. Pasan a aprobadas solo cuando el usuario las corrige o confirma; los platos que el usuario pidió dejar tentativos (A21 teccte de arvejas, A46) llevan `revisar`, y los que él confirmó (A06, A09, A38) llevan `lista_confirmada` (la lista de ingredientes es suya; las cantidades siguen estimadas). Las variantes de un plato (A09B locro con bistec, A09H con huevo frito) se declaran en `VARIANTES` como ingredientes extra sobre el plato base.
- Las leches vegetales (soya, almendras, habas, ajonjolí con maní, quinua, 7 semillas) se modelaron como caseras (grano por vaso); pendiente confirmar si el usuario las compra hechas.

## Arquitectura de la app (Fase 2, carpeta `app/`)

- PWA sin compilación: HTML + CSS + módulos ES nativos, rutas RELATIVAS (para servirla desde un subdirectorio, p. ej. GitHub Pages). `package.json` raíz tiene `"type":"module"` solo para las pruebas de Node.
- `src/formato.js`: funciones PURAS (categorías, formato de cantidades, etiquetas, filtro/búsqueda sin tildes). Aquí irán también escalado, suma de compras y reglas del resumen semanal, para poder probarlas con `node --test` sin navegador.
- `src/db.js`: IndexedDB (tiendas `platos_usuario`, `semanas`, `ajustes`) con respaldo en memoria y timeout de 2 s si el navegador no responde (modo privado, etc.). Los platos de la base NO se guardan ahí: viajan en `data/platos.json` y se mezclan con los del usuario en `src/datos.js`, así actualizar la app no pisa lo del usuario.
- `src/app.js`: render por plantillas de texto (siempre con `escapar`) y delegación de eventos; las pestañas Semana/Compras/¿Qué cocino? son marcadores hasta sus fases.
- `sw.js`: "primero la red, si no hay red la copia" (cache `menu-de-casa-vN`). Es deliberado: en el proyecto anterior las actualizaciones nunca llegaban a quien ya instaló la app. Al agregar archivos nuevos a la app, añadirlos a `BASICOS` en `sw.js` y subir el número de versión del cache.
- NO usar `python -m http.server` para probar: su cola de conexiones es de 5 y el navegador pide ~25 archivos a la vez, así que rechaza conexiones (`ERR_CONNECTION_REFUSED`) y la app se queda en "Cargando…". `scripts/servir.mjs` no tiene ese problema y no sirve nada fuera de `app/`. Tampoco usar el puerto 8080 (bloqueado en esta máquina).
- Verificación visual: Edge headless (`--headless=new --screenshot`) usa un ancho mínimo mayor que un celular; para ver 390 px hay que meter la app en un iframe de 390 px servido por HTTP (un iframe desde `file://` bloquea IndexedDB).

## Semana (Fase 3)

- Modelo (`src/semana.js`, puro): una semana es `{id: "YYYY-MM-DD" del lunes, dias: {lunes..viernes: {desayuno, lonchera, almuerzo, cena:{apoyo}}}}`; cada comida es `{platos, bebidas, frutas, acomp, nota?}` con ids del catálogo. Los campos válidos por comida están en `CAMPOS` de `src/vista_semana.js` (desayuno: plato/bebida/acompañamiento; lonchera: bocado/frutas/refresco; almuerzo: plato/acompañamiento/refresco). Las semanas se guardan en IndexedDB (`semanas`) por id; `ajustes.semana_actual` recuerda la que se estaba viendo.
- El menú se arma a MANO (principal). Las ayudas opcionales están en el menú "⋯": cargar plantilla, repetir semana anterior, sugerir refrescos del almuerzo, vaciar. "Escribir mi propio plato" crea un plato `U…` en `platos_usuario` SIN ingredientes (solo nota `notas_ingredientes`): no suma a compras hasta la fase 5.
- Plantillas: `scripts/f3_plantillas.py` traduce `menus_limpios.json` a ids de catálogo usando los `patron` de `catalogo_fase0.json` (frutas y refrescos también los exportan). Agrupa por secuencia lunes→viernes (descarta duplicados y menús sin día). Si un plato contiene a otro, gana el específico (ver `ids_en` y la lista `D14/D12`, `D09/D28`); `OVERRIDE` corrige casos puntuales (menú 77). Cada comida conserva el texto original en `nota`. 16 plantillas, 62 días.
- Resumen (`resumenSemana`): solo avisos, umbrales en `UMBRALES`. La harina de un acompañamiento cuenta (AC01 arroz, AC12 pan; sus marcas están en `f1_ingredientes.py`). Verdura: solo se evalúan los almuerzos ya armados.
- Refrescos sugeridos: `sugerirRefrescos` llena solo los almuerzos vacíos, distinto cada día y distinto del de la lonchera del mismo día (`ORDEN_REFRESCOS` prioriza limonada, cebada, tamarindo, guanábana).
- `prueba_ui.mjs` maneja Edge por el protocolo CDP con `WebSocket` global de Node 24 y emula 390 px; es la forma fiable de probar la interfaz (la captura `--screenshot` directa usa un ancho mínimo mayor).

## Compras (Fase 4)

- `src/compras.js` (puro): `acumular` recorre la semana y suma por ingrediente; `calcularCompras` redondea a unidad de compra y arma grupos/avisos. Factor por comida (`factor`): desayuno x personas, almuerzo x personas x2 (cena = sobrante), lonchera x1 (niño); recetas `por_litro` (refrescos) = 1/4 L por persona (1/4 L en lonchera); `por_licuado` x1.
- Redondeo (`textoCompra`): kg → pasos de 50 g hasta 1 kg y de 250 g después; litro → 250 ml; `u`/`docena` → unidades enteras; atado/lata/bandeja/frasco/bolsa/paquete/botella → cantidad de envases usando `peso_unidad_g` del maestro (en esos casos = tamaño del envase, ESTIMADO en `TAM_COMPRA` de `f1_ingredientes.py`) y se muestra "necesitas X" debajo.
- Chilcano (`N01`, usa `cabeza_pescado`): cada pescado entero (`PLATOS_PESCADO_ENTERO` = A17 sudado, A18 frito) de ese día o anterior aporta 1 cabeza; la que falta se compra; aviso si el pescado queda a más de 1 día. Solo cuentan los pescados armados en la semana.
- Los básicos (`basico: true`) no entran a la lista salvo que el usuario marque "me falta" (`semana.basicos_faltan`). "Ya compré" se guarda por semana (`semana.comprado`); "ya tengo en casa" es global (`ajustes.despensa`); personas 3/4 en `ajustes.personas`.
- Platos sin ingredientes (propios) o tentativos generan avisos en la lista, no se inventan cantidades.
- `vista_compras.js` conserva abiertas las secciones `<details>` al repintar; importa `semanaActual`/`guardarSemana` de `vista_semana.js` (la semana en edición vive allí).

## Platos propios y copia de seguridad (Fase 5)

- `src/propios.js` (puro): categorías propias (con `base`/`porcion` que deben coincidir con las del catálogo; hay una prueba que lo exige), validación del borrador, `construirPlato`, ingredientes nuevos (`x_…`, solo `kg/u/litro/docena` como forma de compra), borrado que limpia las semanas. Los **básicos pueden ir sin cantidad** (`cant: null, unidad: null` = "al gusto"); los demás ingredientes exigen cantidad > 0. Duplicar un plato del catálogo ("Duplicar y editar") crea una copia `U…` con nombre "(mío)"; el original no se edita.
- `src/respaldo.js` (puro): exporta/valida/sanea. Un archivo importado es DATO NO CONFIABLE: se reconstruye copiando solo campos conocidos, con límites de tamaño y cantidad, y los ids deben cumplir `U…` (platos) o `x_…` (ingredientes). Restaurar AGREGA o REEMPLAZA por id (no borra lo que ya hay) y recarga la página. Se respaldan platos propios, ingredientes propios, semanas y los ajustes `personas` y `despensa`. La fecha del archivo/copia es la LOCAL (`toLocaleDateString("en-CA")`), no la de UTC.
- `src/vista_propios.js`: formulario en el `<dialog id="formulario">`; los atributos de sus botones son `data-ap` (los de Semana usan `data-acc`, los de Compras `data-ac`, y `data-cat`/`data-id` en `#vista` son del catálogo: no reutilizarlos). Antes de cambiar de pantalla dentro del formulario se llama `leerForm()` para no perder lo escrito.
- IndexedDB está en la versión 2 (tienda nueva `ingredientes_usuario`); `datos.js` mezcla los ingredientes propios con el maestro, así Compras los agrupa y redondea como los demás.

## Compartir (Fase 6)

- `src/compartir.js` (puro): tres contenidos, cada uno en TEXTO (WhatsApp, con `*negritas*` y emojis) y en HTML imprimible: **menú de la semana** (tabla días x comidas), **lista de compras** (solo lo que falta: sin lo ya comprado ni lo que ya se tiene) y **hoja del día** para quien cocina (cantidades YA multiplicadas por las porciones de esa comida: almuerzo x2 por la cena, lonchera 1 niño; g/ml a enteros y unidades al cuarto, `cantidadCocina`). `src/vista_compartir.js` arma el cuadro `#compartir`: de un solo `contenido()` salen el texto mostrado, el copiado, el de `wa.me` y el PDF, para que digan lo mismo. Los botones de abrir son `data-sh` (en la barra de Semana y en Compras).
- **PDF = impresión del navegador** (`window.print()` → "Guardar como PDF"), sin librerías. Se llena `#impresion` con el HTML, se pone el título del documento como nombre sugerido y se limpia en `afterprint`. En `@media print` la app oculta todo menos `#impresion`, fuerza `color-scheme: light` (si no, los márgenes salen oscuros por el tema oscuro) y usa clases propias del documento (`.dnom`/`.dcant`; NO reutilizar `.nom`/`.cant`, que son `display:grid` de la pantalla de Compras y rompen la maqueta).
- La firma va DENTRO del documento (su propio `<footer class="firma">`), una sola vez, sin animación; la firma de la pantalla queda oculta al imprimir para no duplicarla. Sigue sin ocultarse al exportar (regla del usuario).
- Verificación real: `prueba_ui.mjs` genera los PDF con `Page.printToPDF` (menu.pdf, compras.pdf, dia.pdf en la carpeta de salida); se pueden leer con `pdfplumber` y dibujar con `pypdfium2`.
- Límite conocido: `wa.me/?text=` tiene tope de longitud; la lista de compras muy larga puede no caber y entonces conviene "Copiar texto".

## Foto de insumos (Fase 7)

- **Dos mitades.** `worker/` es un Cloudflare Worker (su propio `package.json`, con `@anthropic-ai/sdk` 1.x y `zod`) que guarda la clave de API como secreto, valida, aplica tope y llama a Claude; la app (`src/cocinar.js` puro + `src/vista_cocino.js`) reduce la foto a JPEG ≤1280 px, la manda al Worker y deja CONFIRMAR lo detectado antes de calcular. La clave de Claude NUNCA está en la app, el repositorio ni el chat; la app solo guarda la URL del Worker y un código de acceso (`ajustes.foto_url` / `foto_token`, no entran a la copia de seguridad).
- **`worker/src/nucleo.js`** recibe `deps.crearCliente(env)` y `deps.ahora()` inyectados (se prueba sin red). Garantías probadas: falla cerrado si falta clave/código/KV/orígenes; código de acceso comparado en tiempo constante; CORS solo para `ORIGENES`; tope mensual (`TOPE_MES_USD`, reserva de $0.05) y límite por hora en KV; el gasto se cobra aunque la respuesta sea inservible y se suma un cargo de precaución ($0.02) si la llamada pudo cobrarse sin poder leerse; los nombres del catálogo enviado se sanean (una línea cada uno) y el prompt ordena ignorar instrucciones dentro de las fotos; los errores de Anthropic se traducen sin filtrar la clave.
- **Modelo:** por defecto `claude-opus-5-5` (regla de la guía de la API: no bajar de modelo por costo sin que el usuario lo decida); `MODELO` en `wrangler.toml` permite pasar a `claude-haiku-5-5` (~40 veces más barato). Se usa `output_config: {effort: "low", format: zodOutputFormat(...)}` con `messages.parse`; NO enviar `thinking` con presupuesto, `tool_choice` forzado ni `temperature`/`top_p` (dan 400 en estos modelos). No se activan los `fallbacks` por rechazo (la guía los recomienda por defecto para Opus 5.5): para fotos de comida el rechazo es improbable y no se podía verificar el encabezado beta sin clave; el rechazo se maneja devolviendo `rechazado`.
- **Hallazgos al probar con el SDK real** (`worker/test/integracion_sdk.test.mjs`, contra un servidor local que imita `/v1/messages`): el SDK 1.4.0 manda la clave en `Authorization: Bearer` y usa `anthropic-version: 2026-10-21`; y `zodOutputFormat` NO convierte un `z.enum` en restricción real (la deja en la `description`), por eso el esquema es simple (`ingredientes: string[]`, `otros: string[]`) y los ids se validan/filtran en el servidor contra el catálogo.
- **Lo que NO está probado:** ninguna llamada a la API real de Anthropic (no hay clave). `scripts/worker_simulado.mjs` ejecuta el código real del Worker con un Claude falso para probar la app de punta a punta. La guía de despliegue para el usuario es `worker/LEEME.md`.
- **Menú del día** (lo que el usuario esperaba de la foto: "la IA me arma un posible menú"). Dos caminos con la MISMA forma de menú (`src/menu_dia.js`, puro): (1) **con IA**: la app calcula candidatos del catálogo (los de cada categoría con ≥1 ingrediente en casa y ≤4 faltantes, máx. 20) + opciones (acompañamientos, bebidas, frutas que hay, refrescos) y los manda a `POST /menu`; Claude elige ids y escribe una explicación; el Worker FILTRA los ids contra lo recibido y la app vuelve a validar categoría (`limpiarMenu`); (2) **sin IA** (`menuLocal`): puntaje = faltantes×3 + penalización por 3 comidas con harina + sin verdura en el almuerzo − bonos por pescado/menestra; funciona sin servicio. Los faltantes del menú SIEMPRE los calcula la app (`faltantesMenu`), no se confía en lo que diga la IA. "Otro menú" acumula `evitar`; cambiar los insumos descarta el menú. `aplicarMenuADia` + `reemplazarSemana` (en `vista_semana.js`) lo ponen en un día de la semana (pide confirmar si el día ya tiene comidas). La cena no se planea (= sobrante del almuerzo). Un plato sin NINGÚN ingrediente en casa nunca es candidato.
- Worker `/menu`: mismas protecciones que `/analizar` (código de acceso, CORS, tope mensual, límite por hora, cargo de precaución); ambas rutas comparten un solo flujo en `manejar` (`RUTAS` → `preparar*` devuelve sistema/contenido/esquema/`finalizar`). Los nombres que llegan se reducen a una línea; el prompt ordena ignorar instrucciones dentro de los datos.
- `src/cocinar.js`: un plato se considera cocinable con lo que hay si tiene todos sus ingredientes NO básicos con cantidad; "te falta poco" = faltan 1–2. Lo marcado como "ya tengo en casa" (Compras) cuenta como existencia (casilla).

## Tono oscuro y firma

- El tema oscuro es el DEFECTO (variables en `:root`); el claro queda disponible con `<html data-tema="claro">` pero no hay botón. Toda pieza nueva debe usar las variables (`--fondo`, `--tarjeta`, `--texto`, `--suave`, `--linea`, `--verde`…), no colores fijos.
- Firma de autoría en `index.html` (`<footer class="firma">`): "Elaborado por [logo] · Cel. 965754455", 11px, gris `#6b7280`, borde superior fino, logo `logo_systemia.png` (archivo externo en `app/`, copiado de `logo_systemia_cerebro (1).png` de la raíz del proyecto; NO incrustar base64) con parpadeo de opacidad 1↔0.25 en 1.8 s y `mix-blend-mode: multiply`; sin animación en `@media print` y con `prefers-reduced-motion`; si la imagen falla (`onerror`) se muestra el texto "SystemIA". Como el logo es una imagen con fondo claro, va sobre una pastilla blanca (si no, `multiply` lo volvería invisible en tema oscuro). NO se oculta al imprimir/exportar: el usuario dijo que solo se oculte "si te lo indico". No está en `BASICOS` del service worker a propósito (si faltara el archivo, `cache.addAll` rompería la instalación).

## Reglas de negocio ya acordadas (guían todas las fases)

- Cada día: desayuno, lonchera, almuerzo. La cena es "sobrante del almuerzo"; opcionalmente una "cena de apoyo" con licuado (papaya o plátano de seda/morado/común, 1 huevo crudo por licuado, canela, esencia de vainilla), que solo entra a las compras si se marca ese día.
- El almuerzo lleva refresco (cebada, limonada, tamarindo, guanábana y los que ya aparecen en los menús); se sugiere uno distinto por día, editable.
- Compras para 3 o 4 personas (selector): desayuno por persona; almuerzo x2 por la cena; lonchera SIEMPRE para 1 niño; las frutas se suman en un solo renglón; redondear a unidades de compra; lista aparte de "básicos que ya tengo"; casilla "ya compré".
- "Resumen de la semana" con semáforo, SOLO avisos, nunca bloquea: harinas (3+ comidas con arroz/fideo/pan/harina en un día; arroz en más de 3 días; fideo en más de 2; papa, camote y choclo no cuentan), pescado (al menos 2 días, el camuflado cuenta), menestras (al menos 2 almuerzos), verdura (una en cada almuerzo).
- Pescados: atún (lata o lomo), tilapia, jurel, bonito. El chilcano usa la cabeza: si hay un pescado entero antes en la semana se reutiliza su cabeza; si no, se agrega "cabezas de pescado" a las compras. Avisar si el chilcano queda a más de 1 día de la compra del pescado.
- Glosario del usuario: qapchi = crema de queso, leche y galleta (con papas sancochadas); teccte de arvejas, pollo al sillao y puca picante (aquí sin chicharrón) son platos de comida. "fodge" era un error de digitación y el parser lo elimina.
- Interfaz: 4 pestañas (Semana, Compras, Platos, ¿Qué cocino?), pocos botones, lenguaje cotidiano, instalable, sin conexión salvo la foto de insumos. Persistencia local (IndexedDB) con exportar/importar respaldo.
- Foto de insumos (última fase): automática con la API de Claude a través de un Cloudflare Worker intermediario que guarda la clave y aplica un tope de gasto mensual. La clave nunca va en el cliente ni se pide ni se pega en el chat.
