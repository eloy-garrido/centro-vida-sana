import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/auth/'))) {
          try {
            const { handleDevApiRequest } = await server.ssrLoadModule('./src/server/dev-middleware.ts');
            await handleDevApiRequest(req, res);
          } catch (err) {
            console.error('Dev API Middleware Error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: { code: 'DEV_SERVER_ERROR', message: String(err) } }));
          }
        } else {
          next();
        }
      });
    }
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://centrovidasana.cl',
  trailingSlash: 'never',
  output: 'static',
  vite: {
    plugins: [apiDevPlugin()]
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
