# Servicio de fotos de «Menú de casa» — guía de instalación

Este servicio es el **intermediario seguro** entre la app y Claude. Hace **dos cosas** en la pestaña **¿Qué cocino?**:
1. **Reconocer los insumos de una foto** (`/analizar`).
2. **Armar un menú del día** (desayuno, lonchera y almuerzo) con lo que tienes, eligiendo entre los platos de tu catálogo (`/menu`).

Ambas **Tu clave de API vive solo aquí (en Cloudflare)**: nunca está en la app, ni en este repositorio, ni en el chat.

Es **opcional**: sin él, la pestaña ¿Qué cocino? sigue funcionando marcando los insumos a mano.

## Qué hace por ti (seguridad y gasto)

| Protección | Cómo funciona |
|---|---|
| La clave de API no se ve | Se guarda como *secreto* de Cloudflare. La app solo conoce un **código de acceso** que tú inventas. |
| Solo tu app puede usarlo | Pide el código de acceso y solo acepta llamadas desde las direcciones que pongas en `ORIGENES`. |
| Tope de gasto mensual | Al llegar a `TOPE_MES_USD` (por defecto **$2**), se detiene solo hasta el mes siguiente. |
| Límite por hora | Máximo `LIMITE_HORA` fotos por hora (por defecto 40). |
| Falla cerrado | Si falta cualquier dato de configuración, **no atiende nada** (así nunca queda sin tope ni sin código). |
| Fotos acotadas | Máximo 3 fotos por consulta, ~3 MB cada una; la app las reduce antes de enviarlas. |

> El tope es una **medida de seguridad aproximada** (cuenta lo que calcula el servicio, con un pequeño margen de precaución).
> **Pon además un límite de gasto en tu cuenta de Anthropic** (paso 1): esa es la protección definitiva.

## Cuánto cuesta (estimado)

Una foto usa ~3 000 tokens de entrada y ~300 de salida; un menú del día, ~2 500 de entrada y ~400 de salida. Con los precios actuales:

| Modelo (`MODELO` en `wrangler.toml`) | Una foto | Un menú del día | Con el tope de $2 |
|---|---|---|---|
| `claude-opus-5-5` (por defecto) | ~ 2 centavos | ~ 2 centavos | ~ 100 consultas |
| `claude-haiku-5-5` (más económico) | ~ 0,05 centavos | ~ 0,05 centavos | ~ 4 000 consultas |

Son **estimaciones**: el costo real de cada foto te lo muestra la app (**Probar conexión** indica el gasto del mes).
Para reconocer alimentos en una foto, Haiku suele bastar; si ves que se equivoca mucho, vuelve a Opus.

## Instalación (una sola vez, ~20 minutos)

Necesitas: una cuenta en **Cloudflare** (gratis) y **Node.js** (ya lo tienes si usas el proyecto).

**1. Clave de API y límite de gasto (Anthropic)**
1. Entra a <https://console.anthropic.com> → *API keys* → crea una clave. Cópiala (empieza con `sk-ant-`).
2. En *Settings → Limits* pon un **límite de gasto mensual** (por ejemplo $5). Es tu seguro final.
3. **No pegues la clave en ningún chat ni archivo.** Solo la usarás en el paso 6.

**2. Cuenta de Cloudflare**: crea una cuenta gratis en <https://dash.cloudflare.com>.

**3. Preparar la carpeta** (en una terminal, dentro de la carpeta `worker`):
```
npm install
npx wrangler login
```
(`login` abre el navegador para que autorices.)

**4. Crear el contador de gasto**
```
npx wrangler kv namespace create CONTADOR
```
Te mostrará un `id`. Cópialo y pégalo en `wrangler.toml`, en `id = "PEGA_AQUI_EL_ID_DEL_KV"`.

**5. Ajustar `wrangler.toml`**
- `ORIGENES`: las direcciones desde donde se abrirá tu app, **separadas por coma y sin barra final**. Por ejemplo
  `https://TU-USUARIO.github.io,http://127.0.0.1:8765` (la segunda sirve para probar en tu computadora).
  Para probar desde el celular en tu Wi-Fi agrega también `http://192.168.X.X:8765`.
- `TOPE_MES_USD`, `LIMITE_HORA` y `MODELO` si quieres cambiarlos.

**6. Guardar los dos secretos** (cada comando te pide el valor; escríbelo ahí, no en el chat):
```
npx wrangler secret put ANTHROPIC_API_KEY     (pega tu clave sk-ant-…)
npx wrangler secret put APP_TOKEN             (inventa un código largo, p. ej. 4 palabras sin espacios)
```

**7. Publicar**
```
npx wrangler deploy
```
Al terminar muestra una dirección como `https://menu-de-casa-fotos.TU-USUARIO.workers.dev`.

> ⚠️ **No confundas los dos datos.** La **clave de API** (`sk-ant-…`) solo va en Cloudflare (paso 6) y **nunca** en la app.
> En la app solo van la **dirección** del servicio y el **código de acceso** (`APP_TOKEN`), que es una contraseña que tú inventas.
> Si pegas una clave `sk-…` en el campo del código, la app **la rechaza y no la guarda**.

**8. Conectar la app**: en la app, pestaña **¿Qué cocino?** → *Conexión del servicio de fotos* → pega la dirección y el
código de acceso → **Guardar** → **Probar conexión**. Debe decir *«Conectado ✓»* con el modelo y el gasto del mes.

**9. Primera prueba de verdad**: toma una foto de tus insumos y toca **Reconocer insumos**; revisa lo detectado. Luego toca **🤖 Armar menú con IA**: te propone desayuno, lonchera y almuerzo, te dice qué te faltaría comprar y puedes **ponerlo en tu semana**.

> El botón **🧩 Sin IA** arma un menú más simple con una regla sencilla: funciona **sin el servicio y sin internet**.

## Si algo falla

| Mensaje en la app | Qué significa / qué hacer |
|---|---|
| «El código de acceso no es correcto» | El código de la app no coincide con `APP_TOKEN`. Vuelve a ponerlo (`wrangler secret put APP_TOKEN`) y en la app. |
| «No pude conectar con el servicio» | Dirección mal escrita, sin internet, o la dirección de tu app no está en `ORIGENES`. |
| «El servicio no está bien configurado» | Falta el KV, un secreto o `ORIGENES`. Repite los pasos 4–6. |
| «No pudo entrar a Claude: la clave… no es válida» | La clave de API es incorrecta o no tiene saldo. Revísala en console.anthropic.com. |
| «Llegaste al tope de gasto del mes» | Es el tope funcionando. Sube `TOPE_MES_USD` y vuelve a `npx wrangler deploy`, o espera al mes siguiente. |

## Mantenimiento

- **Cambiar de modelo, tope o límite**: edita `wrangler.toml` y ejecuta `npx wrangler deploy`.
- **Si crees que la clave se filtró**: en console.anthropic.com bórrala y crea otra; luego `npx wrangler secret put ANTHROPIC_API_KEY`.
- **Apagarlo del todo**: `npx wrangler delete`.
- **Pruebas del código** (no necesitan clave ni internet): `npm test` dentro de `worker/`.

## Privacidad

Las fotos pasan por tu servicio de Cloudflare hacia Anthropic para ser analizadas y **este servicio no las guarda**.
Se aplican las políticas de Anthropic sobre los datos que se envían a su API. No fotografíes documentos ni personas.
