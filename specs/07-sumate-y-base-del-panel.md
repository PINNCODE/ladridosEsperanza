# SPEC 07 — Formulario Súmate y base del panel `/admin`

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06
> **Fecha:** 2026-10-01
> **Objetivo:** Que un negocio pida sumarse desde `/colabora/sumate` y que el equipo entre a `/admin` con verificación en dos pasos para atender esas solicitudes y descargar el QR de cada negocio.

## Por qué existe esta spec

El índice asignaba a la 07 el formulario Súmate, todo el panel y el QR (RF-15, RF-16, RF-17 y RF-29).
Eso abarca sesión, roles, RLS, subida de imágenes y la edición de unas 20 tablas, incluido el menú de tres niveles.
Se divide en tres specs:

- **07 (esta):** Súmate, sesión con verificación en dos pasos, roles, políticas RLS, bandeja de solicitudes y QR.
- **08:** panel del refugio (peludos, campañas, necesidades, textos, registro de cifras RF-29 e imágenes).
- **09:** panel de negocios y editor de menús.

La antigua 08 (anuncios, analítica, SEO y aviso de privacidad) pasa a ser la 10.

El sitio es estático (SPEC 06), así que el formulario y el panel hablan con Supabase desde el navegador con la llave publicable.
La seguridad la dan las políticas RLS, no las páginas: una página de `/admin` sin sesión no muestra nada porque Postgres no devuelve nada.

## Alcance

**Dentro:**

- Página `/colabora/sumate` con el formulario Súmate; el botón de `SumaTuNegocio` apunta ahí en lugar de WhatsApp.
- Tabla `solicitudes_negocio` con inserción anónima por RLS, campo trampa y límites en Postgres contra spam.
- Página `/aviso-de-privacidad` con texto provisional y enlace en el pie.
- Tabla `usuarios_panel` con el rol (`administrador` o `refugio`) de cada cuenta de Supabase Auth.
- Funciones `rol_panel()` y `es_administrador()` para las políticas RLS de esta y las siguientes specs.
- Verificación en dos pasos con TOTP (app de autenticación), obligatoria para todas las cuentas.
- Páginas del panel: `/admin/entrar`, `/admin/contrasena`, `/admin`, `/admin/solicitudes` y `/admin/qr`.
- Bandeja de solicitudes con cambio de estado (solo administrador).
- QR de cada negocio publicado, generado en el navegador y descargado en PNG y SVG (RF-17, solo administrador).
- `site` de Astro desde la variable `PUBLIC_URL_SITIO`.
- Tres solicitudes de ejemplo en `supabase/seed.sql` y un script que crea dos cuentas de prueba solo en Supabase local.
- Paso manual para aplicar todo en la nube.

**Fuera de alcance (specs futuras):**

- Editar peludos, campañas, necesidades, textos y el registro de cifras RF-29 (SPEC 08).
- Subir imágenes desde el panel (SPEC 08).
- Editar negocios, menús, horarios y promociones (SPEC 09).
- Administrar cuentas y roles desde el panel; se hace en Supabase Studio.
- Nota interna, botón de WhatsApp y borrado en la bandeja de solicitudes.
- Avisos por correo de solicitudes nuevas.
- Aviso de privacidad definitivo, revisado por un profesional (SPEC 10).
- Captcha o verificación con servicios externos (Turnstile).
- Verificación en dos pasos por SMS o WhatsApp.
- Dominio propio.

## Modelo de datos

### Tablas nuevas

| Tabla | Columnas | Notas |
| --- | --- | --- |
| `usuarios_panel` | `id uuid` (llave primaria y foránea a `auth.users`, `on delete cascade`) · `nombre text not null` · `rol text not null` | `check (rol in ('administrador', 'refugio'))` |
| `solicitudes_negocio` | `id uuid default gen_random_uuid()` · `nombre_negocio text not null` · `tipo text not null` · `whatsapp text not null` · `nombre_contacto text` · `mensaje text` · `acepto_aviso boolean not null` · `estado text not null default 'nueva'` · `creada_en timestamptz not null default now()` · `actualizada_en timestamptz` · `es_ejemplo boolean not null default false` | Ver `check` abajo |

`check` de `solicitudes_negocio`:

- `char_length(nombre_negocio) between 2 and 120` y `char_length(tipo) between 2 and 60`.
- `whatsapp ~ '^\d{10}$'` (número mexicano de 10 dígitos, sin lada de país).
- `nombre_contacto` hasta 80 caracteres y `mensaje` hasta 500.
- `acepto_aviso = true`.
- `estado in ('nueva', 'contactada', 'publicada', 'descartada')`.

Ninguna de las dos tablas está en la lista de disparadores `recompilar` de la SPEC 06: una solicitud o una cuenta nueva no inicia un despliegue.

### Funciones

```sql
-- Rol de la cuenta con sesión, o null si no tiene fila en usuarios_panel.
create function public.rol_panel() returns text ...;          -- security definer, stable, search_path = ''

-- true si la sesión completó el segundo paso (aal2) y el rol es 'administrador'.
create function public.es_administrador() returns boolean ...; -- security definer, stable, search_path = ''
```

`es_administrador()` revisa `auth.jwt() ->> 'aal' = 'aal2'`.
Las SPEC 08 y 09 agregan sus políticas con estas mismas funciones.

### Permisos y políticas RLS

| Tabla | Quién | Permiso | Condición |
| --- | --- | --- | --- |
| `usuarios_panel` | `authenticated` | `select` | `id = auth.uid()` y sesión `aal2` |
| `solicitudes_negocio` | `anon` | `insert` solo de `nombre_negocio`, `tipo`, `whatsapp`, `nombre_contacto`, `mensaje`, `acepto_aviso` | `with check (true)`; los `check` y el disparador validan |
| `solicitudes_negocio` | `authenticated` | `select` | `es_administrador()` |
| `solicitudes_negocio` | `authenticated` | `update` solo de `estado` | `es_administrador()` |
| `negocios` | `authenticated` | `select` | `es_administrador()` (para la página de QR) |

Los permisos por columna se hacen con `revoke` del permiso de tabla y `grant insert (…)` o `grant update (estado)`.
`anon` no tiene `select`, así que el formulario inserta sin pedir la fila de vuelta.
Ninguna otra tabla gana políticas en esta spec.

### Contra spam

- Campo trampa `sitio_web` oculto con CSS y `aria-hidden`; si trae texto, el script muestra el mensaje de éxito sin enviar nada.
- Disparador `before insert` en `solicitudes_negocio` que lanza un error si:
  - ya hay una solicitud con el mismo `whatsapp` en las últimas 24 horas (mensaje `whatsapp_repetido`);
  - hay 20 o más solicitudes en la última hora en total (mensaje `limite_por_hora`).
- Otro disparador `before update` pone `actualizada_en = now()`.

### Migraciones

| Archivo en `supabase/migrations/` | Contenido |
| --- | --- |
| `{marca}_panel_cuentas.sql` | `usuarios_panel`, RLS, `rol_panel()`, `es_administrador()` y la política de `usuarios_panel` |
| `{marca}_solicitudes_negocio.sql` | `solicitudes_negocio`, `check`, permisos por columna, políticas, disparadores, y la política de lectura de `negocios` |

### Configuración de Auth en `supabase/config.toml` (local)

| Clave | Valor |
| --- | --- |
| `auth.site_url` | `"http://localhost:4321"` |
| `auth.additional_redirect_urls` | `["http://localhost:4321/admin/contrasena"]` |
| `auth.enable_signup` | `false` (las cuentas se invitan desde Studio) |
| `auth.email.enable_signup` | `true`: en `false` la CLI apaga el proveedor de correo y nadie puede entrar |
| `auth.mfa.totp.enroll_enabled` y `verify_enabled` | `true` |
| `auth.email.template.invite` y `auth.email.template.recovery` | Plantillas en español de `supabase/plantillas/` con el enlace `{{ .SiteURL }}/admin/contrasena?token_hash={{ .TokenHash }}&type=invite` (o `recovery`) |

### Variables de entorno

| Variable | Dónde | Valor |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | `.env`, Vercel | Igual que `SUPABASE_URL` |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env`, Vercel | Llave publicable (`sb_publishable_…`) de `npx supabase status`; se puede versionar en `.env.example` |
| `PUBLIC_URL_SITIO` | `.env`, Vercel | Local: `http://localhost:4321`; Vercel: la URL `*.vercel.app` y, después, el dominio propio |

Sin cualquiera de las tres, `astro build` se detiene con un error que nombra la variable.
`SUPABASE_SECRET_KEY` sigue sin usarse en el navegador.

### Archivos

| Archivo | Contenido |
| --- | --- |
| `src/lib/supabaseNavegador.ts` | Cliente de `@supabase/supabase-js` para el navegador con las dos variables `PUBLIC_`; lo usan el formulario y el panel |
| `src/lib/panel.ts` | `exigirSesion(rol?)`: revisa sesión, nivel `aal2` y rol; si falta algo, redirige a `/admin/entrar`. También `salir()` |
| `src/pages/aviso-de-privacidad.astro` | Aviso provisional: qué datos guarda Súmate, para qué, quién los ve y cómo pedir que se borren; dice "Texto provisional, pendiente de revisión legal" |
| `src/pages/colabora/sumate.astro` | Página con `LayoutColabora` y `FormularioSumate` |
| `src/components/colabora/FormularioSumate.astro` | Formulario y su `<script>` nativo |
| `src/layouts/LayoutPanel.astro` | HTML del panel con `noindex`, sin cinta de ejemplos, sin `Encabezado` ni `Pie` públicos |
| `src/components/admin/EncabezadoPanel.astro` | Nombre, rol, enlaces según el rol y botón "Salir" |
| `src/pages/admin/entrar.astro` | Correo y contraseña, luego alta del TOTP (primera vez) o código de 6 dígitos; enlace "¿Olvidaste tu contraseña?" |
| `src/pages/admin/contrasena.astro` | Destino de los correos de invitación y recuperación; verifica el `token_hash`, pide el código TOTP si la cuenta ya tiene uno y luego la contraseña nueva |
| `src/pages/admin/index.astro` | Inicio del panel según el rol |
| `src/pages/admin/solicitudes.astro` | Bandeja de solicitudes |
| `src/pages/admin/qr.astro` | Lista de negocios publicados con sus QR |
| `scripts/crear-cuentas-prueba.mjs` | Crea `admin@ejemplo.test` y `refugio@ejemplo.test` con sus filas en `usuarios_panel`; se niega a correr si `SUPABASE_URL` no es `127.0.0.1` ni `localhost` |

### Formulario Súmate

| Campo | Control | Regla |
| --- | --- | --- |
| Nombre del negocio | texto | Obligatorio, 2 a 120 caracteres |
| Tipo de negocio | `<select>` con las categorías publicadas (de `src/lib/datos.ts` al compilar) y "Otro" | Obligatorio; "Otro" muestra un campo de texto obligatorio |
| WhatsApp | `tel` con `inputmode="numeric"` | Obligatorio, 10 dígitos; el script quita espacios y guiones |
| Tu nombre | texto | Opcional, hasta 80 caracteres |
| Mensaje | `<textarea>` | Opcional, hasta 500 caracteres |
| Aviso | casilla | Obligatoria, con enlace a `/aviso-de-privacidad` en otra pestaña |

`tipo` guarda el nombre de la categoría elegida o el texto de "Otro".

| Estado | Qué se ve |
| --- | --- |
| Enviando | Botón desactivado con "Enviando…" |
| Éxito | El formulario se reemplaza por "¡Gracias! Te escribiremos por WhatsApp en los próximos días." |
| `whatsapp_repetido` | "Ya recibimos una solicitud con este WhatsApp hoy. Te escribiremos pronto." |
| Cualquier otro error | "No pudimos enviar tu solicitud." y un enlace de WhatsApp al refugio con el mensaje de la SPEC 04 |
| Sin JavaScript | `<noscript>` con el mismo enlace de WhatsApp |

### Panel

| Página | Administrador | Refugio |
| --- | --- | --- |
| `/admin` | Número de solicitudes `nueva`, enlace a la bandeja y enlace a QR | "Pronto podrás editar peludos, campañas y necesidades desde aquí." |
| `/admin/solicitudes` | Lista de la más nueva a la más vieja, filtro por estado (por defecto `nueva`) y `<select>` de estado por fila; las de ejemplo llevan la etiqueta "Ejemplo" | Redirige a `/admin` |
| `/admin/qr` | Un renglón por negocio `publicado` con nombre, URL `{PUBLIC_URL_SITIO}/colabora/{id}`, vista previa y botones "PNG" y "SVG" | Redirige a `/admin` |

Una cuenta sin fila en `usuarios_panel` ve "Tu cuenta no tiene acceso al panel. Pide al administrador que te asigne un rol." y el botón "Salir".
El QR usa el paquete `qrcode`: SVG con `toString` y PNG de 1024 px con `toDataURL`, margen 4, nombres `qr-{id}.svg` y `qr-{id}.png`.
`/admin/qr` muestra el aviso "Si la URL termina en .vercel.app, el QR dejará de servir cuando el sitio pase a su dominio propio." cuando `PUBLIC_URL_SITIO` contiene `vercel.app`.

## Plan de implementación

1. Cambiar la sección `[auth]` de `supabase/config.toml` como dice la tabla de configuración. Reiniciar con `npx supabase stop` y `npx supabase start`, y comprobar que el sitio compila igual.
2. Crear la migración `panel_cuentas`. Comprobar con `npx supabase db reset` que se aplica y que `rol_panel()` devuelve `null` sin sesión.
3. Crear la migración `solicitudes_negocio` y agregar a `supabase/seed.sql` tres solicitudes con `es_ejemplo = true` (una `nueva`, una `contactada`, una `descartada`). Comprobar con `curl` y la llave publicable que un `insert` válido responde 201, que un `select` devuelve `[]` y que el mismo WhatsApp dos veces falla con `whatsapp_repetido`.
4. Crear `scripts/crear-cuentas-prueba.mjs`. Comprobar que crea las dos cuentas en local y que se niega a correr con otra URL.
5. Agregar las tres variables `PUBLIC_` a `.env.example`, leer `PUBLIC_URL_SITIO` como `site` en `astro.config.mjs` y crear `src/lib/supabaseNavegador.ts` con el error por variable faltante.
6. Crear `src/pages/aviso-de-privacidad.astro` y el enlace "Aviso de privacidad" en `Pie`.
7. Crear `FormularioSumate` y `src/pages/colabora/sumate.astro`, y cambiar el botón de `SumaTuNegocio` a un enlace a `/colabora/sumate`. Comprobar que un envío crea la fila en local.
8. Crear `LayoutPanel`, `src/lib/panel.ts`, `/admin/entrar` y `/admin/contrasena`. Comprobar que la cuenta de prueba da de alta su TOTP y entra.
9. Crear `EncabezadoPanel` y `/admin` con las dos vistas por rol y la de cuenta sin rol.
10. Crear `/admin/solicitudes`.
11. Agregar `qrcode` y `@types/qrcode`, y crear `/admin/qr`.
12. Paso manual en la nube (cuando existan los proyectos de la SPEC 06): `npx supabase db push`; en el panel de Supabase activar TOTP, desactivar el registro abierto (sin apagar el proveedor de correo), poner el Site URL y la URL de redirección `/admin/contrasena` de Vercel y copiar las dos plantillas de `supabase/plantillas/` en Authentication → Emails; cargar las tres variables `PUBLIC_` en Vercel; invitar a la primera cuenta desde Studio e insertar su fila `administrador` en `usuarios_panel`.
13. Actualizar `specs/README.md` (la 07 con este título y RF-15, RF-17 y la base de RF-16; nuevas filas 08 "Panel del refugio", 09 "Panel de negocios y menús" y 10 "Anuncios, analítica, SEO y aviso de privacidad"; RF-29 pasa a la 08; quitar las pendientes de la 07 y mover las de la 08 a la 10) y `CLAUDE.md` (rutas nuevas, `src/lib/supabaseNavegador.ts`, `src/lib/panel.ts`, `LayoutPanel`, `src/components/admin/`, variables nuevas y el script de cuentas de prueba).

## Criterios de aceptación

### Formulario Súmate

- [x] El botón "Quiero sumar mi negocio" de `/colabora` lleva a `/colabora/sumate`.
- [x] El `<select>` de tipo lista las categorías del catálogo y "Otro"; elegir "Otro" muestra un campo de texto obligatorio.
- [x] Enviar sin marcar la casilla del aviso no envía nada y el navegador marca la casilla.
- [x] Un envío válido muestra "¡Gracias! Te escribiremos por WhatsApp en los próximos días." y crea una fila `nueva` con `acepto_aviso = true` y `es_ejemplo = false`.
- [x] "55 1234-5678" se guarda como `5512345678`.
- [x] Un segundo envío con el mismo WhatsApp en menos de 24 horas muestra el mensaje de solicitud repetida y no crea fila.
- [x] Con 20 solicitudes en la última hora, el siguiente envío muestra "No pudimos enviar tu solicitud." con el enlace de WhatsApp.
- [x] Con el campo `sitio_web` lleno, se ve el mensaje de éxito y no se crea fila.
- [x] Con JavaScript desactivado, `/colabora/sumate` muestra el enlace de WhatsApp del refugio.
- [x] Con la llave publicable, un `insert` por PostgREST que incluye `estado` o `es_ejemplo` falla por permisos.
- [x] Con la llave publicable, `select * from solicitudes_negocio` devuelve 0 filas.
- [x] `/aviso-de-privacidad` abre desde la casilla y desde el pie, y dice "Texto provisional, pendiente de revisión legal".
- [x] `/colabora/sumate` no tiene desplazamiento horizontal a 360 px.

### Sesión y roles

- [x] `/admin`, `/admin/solicitudes` y `/admin/qr` sin sesión redirigen a `/admin/entrar` sin mostrar datos.
- [x] Una cuenta sin TOTP ve el código QR de alta y el secreto en texto, y no entra al panel hasta confirmar un código válido.
- [x] Una cuenta con TOTP que pone una contraseña correcta y no pone el código no ve datos del panel.
- [x] Con sesión `aal1` (solo contraseña), `select` a `solicitudes_negocio` por PostgREST devuelve 0 filas.
- [x] Un código TOTP incorrecto muestra un error y no entra.
- [x] La cuenta de prueba `refugio` ve el aviso "Pronto podrás editar…" y no ve enlaces a solicitudes ni a QR; abrir `/admin/solicitudes` la regresa a `/admin`.
- [x] Con la sesión `aal2` de la cuenta `refugio`, `select` a `solicitudes_negocio` y a `negocios` por PostgREST devuelve 0 filas.
- [x] Una cuenta sin fila en `usuarios_panel` ve "Tu cuenta no tiene acceso al panel…".
- [x] `supabase.auth.signUp` con la llave publicable falla porque el registro está desactivado.
- [x] El correo de recuperación (en Mailpit local) lleva a `/admin/contrasena`, y la contraseña nueva sirve para entrar.
- [x] "Salir" cierra la sesión y regresa a `/admin/entrar`.
- [x] Las páginas de `/admin` llevan `<meta name="robots" content="noindex">` y no muestran la cinta "Datos de ejemplo".

### Bandeja y QR

- [x] `/admin` del administrador muestra el número de solicitudes `nueva` y coincide con la base.
- [x] `/admin/solicitudes` abre filtrada en `nueva`, de la más nueva a la más vieja, y las de la semilla llevan la etiqueta "Ejemplo".
- [x] Cambiar una solicitud a `contactada` la guarda, llena `actualizada_en` y se conserva al recargar.
- [x] Guardar un cambio de estado no inicia un despliegue (no hay llamada en `net.http_request_queue`).
- [x] `/admin/qr` lista los negocios `publicado` y no los `pausado` ni `borrador`.
- [x] "SVG" descarga `qr-tacos-don-chuy.svg` y "PNG" descarga `qr-tacos-don-chuy.png` de 1024 × 1024 px.
- [x] Leer el QR con un teléfono abre `{PUBLIC_URL_SITIO}/colabora/tacos-don-chuy`.
- [x] Con `PUBLIC_URL_SITIO` en `*.vercel.app`, `/admin/qr` muestra el aviso del dominio.

### Compilación y seguridad

- [x] `npx supabase db reset` aplica las 5 migraciones y la semilla sin errores, con 3 solicitudes de ejemplo.
- [x] Sin `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `astro build` se detiene con un mensaje que la nombra; igual con `PUBLIC_SUPABASE_URL` y `PUBLIC_URL_SITIO`.
- [x] `astro build` y `astro check` terminan sin errores.
- [x] La llave secreta no aparece en ningún archivo de `dist/`.
- [x] Solo `src/lib/cargadores.ts` importa `src/lib/supabase.ts`, y solo el formulario y el panel importan `src/lib/supabaseNavegador.ts`.
- [x] Las páginas públicas existentes generan el mismo HTML que antes, salvo el enlace del pie y el botón de Súmate.

### Nube (después del paso 12)

- [x] Un envío desde `*.vercel.app/colabora/sumate` aparece en `/admin/solicitudes` de la nube.
- [x] La cuenta invitada desde Studio recibe el correo, pone su contraseña, da de alta su TOTP y entra.
- [x] El registro abierto está desactivado en el proyecto de la nube.

### Observaciones de la validación

Validado el 2026-10-01 en local, con Supabase en Docker (Colima) y la compilación de producción servida con `astro preview`; Playwright a 360 y 1024 px. Los códigos TOTP se calcularon en la página con WebCrypto a partir del secreto que muestra el alta.

- **Paso 12 (nube), validado el 2026-10-02** en `https://ladridos-esperanza.vercel.app` y el proyecto de Supabase "Refugio animales":
  - `npx supabase db push` aplicó `panel_cuentas` y `solicitudes_negocio`, sin semilla. Con la llave publicable, `solicitudes_negocio` y `usuarios_panel` devuelven `[]`, un `insert` con `estado` responde 401 y `signUp` responde `signup_disabled`.
  - Las variables `PUBLIC_` van en Vercel para **Production y Preview**. Con solo Production, la vista previa del PR falló con "Falta la variable de entorno PUBLIC_SUPABASE_URL".
  - El correo integrado de Supabase solo envía a miembros del equipo y no deja editar plantillas. Se compró `ladridosdeesperanza.org` en Cloudflare y se configuró el SMTP de Resend (`smtp.resend.com:465`, usuario `resend`, remitente `no-reply@ladridosdeesperanza.org`). Un usuario distinto de `resend` falla con `535 "Invalid username"`.
  - Las plantillas se subieron con la API de administración (`PATCH /v1/projects/{ref}/config/auth`). Los correos enviados segundos después del cambio todavía salieron con la plantilla por defecto: Auth tarda unos minutos en recargar la configuración. Ese enlace pasa por `/auth/v1/verify` y deja la sesión en el `#`, que `/admin/contrasena` no reconoce ("Este enlace ya se usó o venció").
  - La primera cuenta se invitó desde Studio; su rol se insertó con SQL. La contraseña se eligió con el correo de recuperación ya con la plantilla nueva, y la cuenta dio de alta su TOTP y entró al panel.
  - Una solicitud enviada desde `/colabora/sumate` apareció en `/admin/solicitudes`. El cambio a `contactada` se guardó y llenó `actualizada_en`.
- **`auth.email.enable_signup`.** La spec pedía `false`, pero en la CLI esa clave apaga el proveedor de correo: el inicio de sesión respondía `email_provider_disabled`. Queda en `true`; el registro abierto lo cierra `auth.enable_signup = false` y `signUp` responde `signup_disabled`.
- **Plantillas de correo.** Una invitación desde Studio no deja elegir la redirección y el enlace por defecto cae en `site_url` (la portada). Se agregaron plantillas en español (`supabase/plantillas/`) que llevan a `/admin/contrasena?token_hash=…&type=…`, y la página lo verifica con `verifyOtp`. En la nube hay que copiarlas a mano (paso 12).
- **Contraseña con TOTP.** Supabase exige `aal2` para cambiar la contraseña de una cuenta con TOTP (`insufficient_aal`). `/admin/contrasena` pide primero el código cuando la cuenta ya tiene un factor y después entra directo a `/admin`; una invitación nueva pasa a `/admin/entrar` para dar de alta el TOTP.
- **`rol_panel()` también exige `aal2`.** Así cualquier política futura que use el rol queda protegida por el segundo paso, como pide la decisión de exigir `aal2` en las funciones.
- **Permisos de `solicitudes_negocio`.** `anon` tiene `select` sin política, como las tablas de contenido, para que la API devuelva `[]` y no un error de permisos. `authenticated` también puede insertar las columnas del formulario, porque el navegador manda la sesión del panel si la hay.
- **Tipo de negocio.** El `<select>` lista todas las categorías por `orden` (`categoriasOrdenadas()` en `src/lib/datos.ts`), no solo las que ya tienen negocios: un negocio nuevo puede ser de una categoría sin negocios publicados.
- **Formulario.** "55 1234-5678" se guardó como `5512345678`; el repetido mostró su mensaje; con 20 solicitudes en la hora, el siguiente envío mostró "No pudimos enviar tu solicitud." con el enlace de WhatsApp; con `sitio_web` lleno no se creó fila. Sin JavaScript, el formulario queda oculto y se ve el enlace de WhatsApp.
- **API pública.** Con la llave publicable, un `insert` con `estado` o `es_ejemplo` responde 401 `permission denied`; uno sin `acepto_aviso` falla por el `check`; `select` devuelve `[]`. Con sesión `aal1` (admin) y con `aal2` de la cuenta `refugio`, `solicitudes_negocio` y `negocios` devuelven `[]`.
- **QR.** `qr-tacos-don-chuy.png` mide 1024 × 1024 px. En lugar de un teléfono, el PNG se decodificó con `jsqr` y dio `http://localhost:4321/colabora/tacos-don-chuy`. Con Pizzería Nonna Lupe en `pausado` y Panadería San Juan en `borrador`, la lista mostró solo los otros 3; después se restauraron. Con `PUBLIC_URL_SITIO=https://ladridos-prueba.vercel.app` apareció el aviso del dominio y las URL usaron ese host.
- **Recompilación.** `solicitudes_negocio` solo tiene los disparadores `limitar` y `actualizada`; tras cambiar un estado, `net.http_request_queue` quedó vacía.
- **HTML público.** Comparado con una compilación de antes del cambio (11 páginas), solo cambian el enlace "Aviso de privacidad" del pie en todas y el botón de `/colabora`; se agregan 7 páginas (`/colabora/sumate`, `/aviso-de-privacidad` y las 5 de `/admin`).
- **`.env.local`.** El equipo tiene un `.env.local` (de la CLI de Vercel) con el `SUPABASE_URL` de la nube, que gana sobre `.env`. Para compilar contra Supabase local hay que pasar `SUPABASE_URL` y `SUPABASE_SECRET_KEY` locales en el entorno.
- **Después de `db reset`.** PostgREST tarda unos segundos en recargar su caché; si `crear-cuentas-prueba.mjs` falla con `PGRST002`, basta con correrlo otra vez.

## Decisiones

- **Sí:** dividir la 07 del índice en 07, 08 y 09. Sesión, roles y RLS son la base que las otras dos usan; juntas serían una spec imposible de validar.
- **Sí:** páginas Astro con `<script>` nativos para el panel. Es la misma forma del sitio público y no agrega dependencias.
- **No:** React (lo propone la spec padre) ni Svelte. Facilitan formularios con mucho estado, pero agregan un framework para un panel de 2 o 3 personas; el editor de menús de la SPEC 09 puede reabrirlo si hace falta.
- **Sí:** el formulario inserta directo con la llave publicable y RLS. El sitio sigue estático y no hay servidor que mantener.
- **No:** Edge Function ni función en Vercel para Súmate. Una pieza más que desplegar; la función en Vercel rompe el sitio estático que eligió la SPEC 06.
- **Sí:** campo trampa y límites en un disparador de Postgres. Frenan bots simples y envíos repetidos sin servicios externos.
- **No:** Turnstile. Necesita un servidor que valide el token.
- **Sí:** permisos por columna para `anon`. Nadie puede crear una solicitud ya `publicada` o marcada como ejemplo.
- **Sí:** `tipo` como texto con el nombre de la categoría. "Otro" no tiene categoría, y una solicitud no debe impedir borrar una categoría.
- **Sí:** WhatsApp de 10 dígitos. El formulario es para negocios de Tenancingo; la lada de país se agrega al armar el enlace cuando haga falta.
- **Sí:** TOTP de Supabase Auth, obligatorio para todos. Gratis e incluido; la cuenta del refugio también editará datos públicos en la SPEC 08.
- **No:** códigos por SMS o WhatsApp. Supabase cobra el proveedor de SMS.
- **Sí:** el nivel `aal2` se exige en las funciones de las políticas, no solo en las páginas. Las páginas son estáticas y cualquiera puede llamar a la API.
- **Sí:** cuentas invitadas desde Studio y rol en `usuarios_panel`. Son 2 o 3 personas; invitar desde el navegador necesitaría la llave secreta en una función.
- **No:** rol en `app_metadata`. Cambiar un rol obligaría a renovar la sesión, y la tabla se consulta con un `join` simple.
- **Sí:** registro abierto desactivado. Sin eso, cualquiera crea una cuenta; aunque no tenga rol, no debe existir.
- **Sí:** la cuenta `refugio` entra en esta spec y ve un aviso. Así se prueba el rol y el TOTP antes de la SPEC 08.
- **Sí:** bandeja solo con cambio de estado. Es lo mínimo de RF-15; nota, WhatsApp y borrado se agregan cuando se pidan.
- **No:** aviso por correo de solicitudes nuevas. Necesita una cuenta en un servicio de correo y un secreto más.
- **Sí:** página `/aviso-de-privacidad` provisional. RF-15 exige aceptarla y no puede apuntar a una página que no existe; la SPEC 10 pone el texto definitivo.
- **Sí:** QR generado en el navegador con `qrcode`. No se guarda nada y siempre usa la URL actual.
- **No:** QR como archivos generados al compilar. Quedarían públicos y habría que regenerarlos al cambiar de dominio.
- **Sí:** `site` desde `PUBLIC_URL_SITIO`. Pasar al dominio propio solo cambia la variable.
- **Sí:** cuentas de prueba con un script solo para local. `seed.sql` puede subirse a la nube con `db push --include-seed` y llevaría contraseñas conocidas.
- **Sí:** solicitudes de ejemplo con `es_ejemplo` y etiqueta en la bandeja. Sirven para desarrollar y se distinguen si llegan a la nube.
- **Sí:** solicitudes y cuentas no inician despliegues. No cambian nada de lo que muestra el sitio.
- **Sí:** validar en local y dejar los criterios de la nube sin marcar hasta que existan los proyectos, igual que la SPEC 06.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Alguien pierde el teléfono con su app de autenticación | El administrador borra su factor TOTP en Studio (Authentication → Users) y la persona lo da de alta otra vez al entrar. |
| El único administrador pierde el acceso | La spec padre pide una segunda persona con rol de administrador; el paso 12 lo recuerda. |
| Un bot llena la tabla desde muchos números | El límite de 20 por hora frena el volumen; la bandeja filtra por estado y las descartadas no estorban. |
| El límite de 20 por hora bloquea a negocios reales en un día de difusión | El mensaje de error ofrece WhatsApp; el límite está en un solo disparador y se cambia con una migración. |
| Una política mal escrita expone solicitudes | Hay criterios que consultan con `anon`, con `aal1` y con el rol `refugio` por PostgREST. |
| La sesión de Supabase vive en `localStorage` del navegador | Solo da acceso con `aal2`; "Salir" la borra. Es el comportamiento por defecto de `supabase-js` en sitios estáticos. |
| Un QR impreso con `*.vercel.app` deja de servir al pasar al dominio propio | Aviso visible en `/admin/qr`; los QR para imprimir se descargan cuando exista el dominio. |
| La configuración de Auth de `config.toml` no llega a la nube | El paso 12 la repite a mano en el panel de Supabase; hay un criterio que comprueba el registro desactivado en la nube. |
| El correo de Supabase en la nube tiene un límite bajo de envíos por hora | Son pocas invitaciones y recuperaciones; si hace falta, se configura un SMTP propio en otra spec. |

## Lo que **no** entra en esta spec

- Edición de contenido del refugio, registro de cifras RF-29 e imágenes (SPEC 08).
- Edición de negocios y menús (SPEC 09).
- Administrar cuentas desde el panel.
- Nota interna, WhatsApp y borrado en la bandeja.
- Avisos por correo.
- Aviso de privacidad definitivo (SPEC 10).
- Captcha externo y verificación por SMS.
- Dominio propio.

Cada una de estas, si llega, va en su propia spec.
