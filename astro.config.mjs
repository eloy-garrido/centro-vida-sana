import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://centrovidasana.cl',
  trailingSlash: 'never',
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
