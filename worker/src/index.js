// Punto de entrada del Cloudflare Worker. Aquí (y solo aquí) se crea el cliente con la clave de API,
// que viene del secreto ANTHROPIC_API_KEY de Cloudflare: nunca está en el código, en la app ni en el repositorio.
import Anthropic from "@anthropic-ai/sdk";
import { manejar } from "./nucleo.js";

export default {
  async fetch(request, env) {
    return manejar(request, env, {
      crearCliente: (e) => new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 }),
      ahora: () => new Date(),
    });
  },
};
