# Ladridos de Esperanza

Sitio web del refugio Ladridos de Esperanza, en Tenancingo: adopciones, campañas de esterilización, donativos y "Come por los Peludos", el catálogo de negocios que apoyan al refugio.

**En producción:** https://www.ladridosdeesperanza.org

## Qué tiene

- **Sitio del refugio:** portada, `/adopta`, `/esterilizacion`, `/donar` y `/aviso-de-privacidad`.
- **Come por los Peludos:** catálogo `/colabora` con búsqueda, filtros y "abierto ahora"; una página por negocio con menú, horarios, promoción y contacto por WhatsApp; formulario `/colabora/sumate` para sumar un negocio.
- **Panel `/admin`:** acceso con contraseña y verificación en dos pasos (TOTP), con dos roles:
  - **Refugio:** peludos, campañas, necesidades, textos y cifras mensuales.
  - **Administrador:** todo lo anterior, más negocios, categorías, menús, solicitudes de Súmate y códigos QR por negocio.
- **SEO y analítica:** etiquetas para compartir, JSON-LD, mapa del sitio, `robots.txt` y Umami Cloud sin cookies (solo en Production).

Cada cambio guardado en el panel inicia un despliegue en Vercel, y el sitio se recompila además todos los días a las 00:05 (hora de la Ciudad de México).

## Tecnología

- [Astro 7](https://astro.build) como sitio estático, con Tailwind CSS v4 y `<script>` nativos (sin React ni Svelte).
- [Supabase](https://supabase.com): Postgres, Auth, Storage y RLS. El sitio lee los datos al compilar; el panel y el formulario Súmate hablan con Supabase desde el navegador con la llave publicable.
- [Vercel](https://vercel.com) para el hosting; Resend para los correos del panel; Cloudflare para el dominio y el correo `privacidad@`.

## Desarrollo local

Requisitos: Node.js 22.12 o más reciente y Docker (o Colima) para Supabase local.

```sh
npm install
cp .env.example .env          # pega en SUPABASE_SECRET_KEY la "Secret" de `npx supabase status`
npx supabase start            # Supabase local con migraciones, semilla e imágenes de ejemplo
node scripts/crear-cuentas-prueba.mjs   # cuentas locales del panel
npx astro dev --background    # http://localhost:4321
```

Cuentas locales del panel: `admin@ejemplo.test` y `refugio@ejemplo.test`, contraseña `panel-prueba-2026`. Cada una registra su TOTP la primera vez que entra en `/admin/entrar`. Los correos locales llegan a Mailpit en http://127.0.0.1:54324.

Los datos se cargan al iniciar el servidor: después de cambiar algo en Supabase, reinicia `astro dev`. `npx supabase db reset` vuelve a aplicar las migraciones y la semilla.

## Comandos

| Comando | Acción |
| :-- | :-- |
| `npx astro dev --background` | Servidor de desarrollo en segundo plano (`astro dev stop`, `status` y `logs` lo manejan) |
| `npm run build` | Compila el sitio en `./dist/` (necesita Supabase en marcha) |
| `npm run preview` | Sirve la compilación localmente |
| `npx astro check` | Revisión de tipos |
| `npx supabase db reset` | Reaplica migraciones y semilla en local |
| `node scripts/generar-favicons.mjs` | Regenera los favicons a partir del logo |

## Datos de ejemplo

Todos los registros tienen `es_ejemplo`. Los de ejemplo solo se incluyen con `PUBLIC_MOSTRAR_EJEMPLOS=true`, y entonces el sitio muestra la cinta "Datos de ejemplo". Sin esa variable, la compilación falla hasta que exista un registro real del refugio, para que los datos de ejemplo nunca se publiquen por error.

## Publicación

- El trabajo entra por pull request en GitHub (`PINNCODE/ladridosEsperanza`); cada pull request tiene su despliegue Preview en Vercel y el merge a `main` publica en Production.
- Las migraciones nuevas se aplican a mano en el proyecto de Supabase en la nube con `npx supabase db push` (no sube la semilla).
- Las variables de entorno de Vercel y su propósito están descritas en `.env.example` y en `CLAUDE.md`.

## Estructura

```text
src/
  pages/        rutas del sitio y del panel /admin
  components/   componentes por sección (portada, adopta, colabora, admin, …)
  layouts/      Layout, LayoutColabora y LayoutPanel
  lib/          cargadores de Supabase, consultas, formato, horarios, panel, SEO y analítica
  styles/       tokens de diseño y animaciones
supabase/       migraciones, semilla, imágenes de ejemplo y plantillas de correo
specs/          specs del proyecto (índice en specs/README.md)
referencias/    spec padre y prototipo HTML
scripts/        cuentas de prueba y favicons
```

La guía detallada del código está en [`CLAUDE.md`](CLAUDE.md) (igual a [`AGENTS.md`](AGENTS.md)).

## Pendiente

- SPEC 12, anuncios (RF-18), está por escribir.
- Producción todavía muestra los datos de ejemplo: falta cargar los registros reales del refugio y quitar `PUBLIC_MOSTRAR_EJEMPLOS` en Vercel.
- El aviso de privacidad está pendiente de revisión legal.
- Pedir al refugio fotos y logo en resolución original, y confirmar las condiciones del apadrinamiento y el voluntariado.
