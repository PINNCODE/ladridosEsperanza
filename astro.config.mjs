// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// Las imágenes viven en Supabase Storage (SPEC 06); Astro solo descarga y optimiza las de ese host.
// Con prefijo vacío, loadEnv lee .env y también las variables del entorno (Vercel).
const env = loadEnv('production', '.', '');
const { SUPABASE_URL } = env;
const supabase = SUPABASE_URL ? new URL(SUPABASE_URL) : null;

// El formulario Súmate y el panel /admin (SPEC 07) usan estas variables en el navegador,
// y la URL del sitio es el destino de los QR. Sin alguna, la compilación se detiene.
for (const nombre of ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'PUBLIC_URL_SITIO']) {
  if (!env[nombre]) {
    throw new Error(`Falta la variable de entorno ${nombre}. En desarrollo, copia sus valores de .env.example a .env.`);
  }
}

// https://astro.build/config
export default defineConfig({
  site: env.PUBLIC_URL_SITIO,
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
