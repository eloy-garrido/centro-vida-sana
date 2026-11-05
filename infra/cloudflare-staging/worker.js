/**
 * Centro Vida Sana Austral — Worker Staging
 * Enruta /api/* y /auth/* a handleApiRequest conectado a Cloudflare D1 (env.DB).
 * Sirve páginas y recursos estáticos de Astro a través de env.ASSETS.
 */

import { createD1Adapter } from '../../src/server/db/adapter.ts';
import { handleApiRequest } from '../../src/server/router.ts';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Endpoints de API y Autenticación
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'D1 binding DB no configurado.' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
      const db = createD1Adapter(env.DB);
      return handleApiRequest(request, db, { env });
    }

    // 2. Activos y páginas estáticas compiladas de Astro
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback para rutas no coincidentes
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }
};
