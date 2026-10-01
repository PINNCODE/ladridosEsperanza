// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// Las imágenes viven en Supabase Storage (SPEC 06); Astro solo descarga y optimiza las de ese host.
// Con prefijo vacío, loadEnv lee .env y también las variables del entorno (Vercel).
const { SUPABASE_URL } = loadEnv('production', '.', '');
const supabase = SUPABASE_URL ? new URL(SUPABASE_URL) : null;

// https://astro.build/config
export default defineConfig({
  image: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(':', ''),
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: '/storage/v1/object/public/imagenes/**',
          },
        ]
      : [],
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Bricolage Grotesque',
      cssVariable: '--fuente-titulos',
      weights: ['400 800'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'DM Sans',
      cssVariable: '--fuente-texto',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
