# SPEC 18 — Contacto por Messenger

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 03, SPEC 06, SPEC 11, SPEC 13, SPEC 17
> **Fecha:** 2026-10-03
> **Objetivo:** Que todos los botones de contacto del refugio abran un chat de Messenger con la página SOS Ladridos de Esperanza Tenancingo en lugar de WhatsApp, y que copien el mensaje para que el refugio sepa de qué le escriben.

## Por qué existe esta spec

El refugio no tiene WhatsApp. Atiende todo por mensajes directos en Facebook, desde la página SOS Ladridos de Esperanza Tenancingo (`facebook.com/p/Sos-Ladridos-de-Esperanza-Tenancingo-100067644922613`). Hoy el sitio tiene 10 botones que abren `wa.me` con un número de relleno: en la nube, `refugio.whatsapp` es `5215555555555`. Quien quiere adoptar, donar o reservar en una campaña llega a un número que no existe.

`m.me/{cuenta}` abre Messenger con esa cuenta: en el teléfono abre la app y en la computadora, messenger.com. A diferencia de `wa.me?text=`, Meta no garantiza el mensaje prellenado. Por eso el botón copia el mensaje al portapapeles y le avisa a la persona que lo pegue.

Los negocios (SPEC 05, 07 y 09) sí tienen WhatsApp propio y no cambian.

## Alcance

**Dentro:**

- Migración `messenger_refugio`: columna nueva `refugio.messenger` (obligatoria, llenada con `100067644922613`) y se borra la columna `refugio.whatsapp`.
- `src/lib/messenger.ts` con `enlaceMessenger(cuenta)` → `https://m.me/{cuenta}`.
- Componente `src/components/EnlaceMessenger.astro`: el `<a>` de todo contacto con el refugio. Lleva el mensaje en `data-mensaje` y el evento de Umami `mensaje` con su `motivo`.
- Componente `src/components/AvisoMensaje.astro`, incluido una sola vez en `Layout`: el aviso "Copiamos tu mensaje…" y el script que copia el mensaje al tocar cualquier `EnlaceMessenger`.
- Los 10 botones de contacto del refugio pasan a `EnlaceMessenger`, con el mismo mensaje que llevan hoy:

  | Componente | Texto del botón | `motivo` |
  | --- | --- | --- |
  | `adopta/BarraPeludo` | Quiero adoptar a {nombre} (sin cambio) | `adopcion` (+ `peludo`) |
  | `adopta/GaleriaPeludos` (sin peludos) | Escríbenos por Messenger | `contacto` |
  | `pages/adopta.astro` | Escríbenos por Messenger | `contacto` |
  | `portada/Adopciones` (sin peludos) | Escríbenos por Messenger | `contacto` |
  | `portada/Donativos` (2 botones) | sin cambio | `donativo`, `especie` |
  | `portada/Esterilizacion` | Reservar mi lugar (sin cambio) | `esterilizacion` |
  | `esterilizacion/FichaCampana` | Reservar mi lugar (sin cambio) | `esterilizacion` |
  | `donar/FormasDeAyudar` (3 botones) | sin cambio | `donativo`, `apadrinar`, `voluntariado` |
  | `portada/RedesContacto` | Escríbenos por Messenger | `contacto` |
  | `Pie` | Messenger del refugio | `contacto` |

  Hoy `GaleriaPeludos`, `adopta.astro` y `Adopciones` no mandan evento de Umami; con `EnlaceMessenger` lo mandan con `motivo` `contacto`.
- Textos que nombran WhatsApp, cambiados a Messenger:
  - `portada/Donativos` y `donar/FormasDeAyudar`: "Pide los datos oficiales por Messenger para donar con seguridad."
  - El aviso de seguridad de `donar/FormasDeAyudar`: "El único canal oficial para donar es el Messenger al que lleva este botón. No publicamos cuentas bancarias en esta página. Desconfía de perfiles que te escriban primero pidiendo dinero."
  - `admin/campanas/editar`: "No escribas datos bancarios: el sitio pide escribir por Messenger para recibirlos."
  - `admin/index`: la tarjeta de Estadísticas dice "clics a Messenger".
  - Comentarios de los componentes tocados.
- Aviso de privacidad:
  - La sección "WhatsApp" pasa a llamarse "Messenger". Dice que el botón copia el mensaje en el portapapeles del dispositivo sin que el sitio lo guarde, y que abre una conversación con la página de Facebook del refugio sujeta a la política de privacidad de Meta.
  - En la analítica dice "los clics a Messenger". Con negocios visibles dice "los clics a Messenger, al WhatsApp de los negocios, …".
- `src/lib/seo.ts`: el JSON-LD `AnimalShelter` ya no lleva `telephone`. `sameAs` con las redes ya existe y no cambia.
- `seed.sql`: `refugio` con `messenger` en lugar de `whatsapp`. Los bloques `proceso-adopcion` y `pregunta-reservar` dicen "Escríbenos por Messenger".
- Paso de datos: en la nube, los bloques `proceso-adopcion` y `pregunta-reservar` dicen "WhatsApp" en su texto. Se corrigen en `/admin/textos` junto con el paso 7 de la SPEC 17.
- `CLAUDE.md`, `AGENTS.md` y `specs/README.md` al día. Esta spec es la 18 y anuncios pasa a la 19. La SPEC 17 ya no pide corregir `refugio.whatsapp` en su paso 8.

**Fuera de alcance (specs futuras):**

- El WhatsApp de los negocios: `negocios.whatsapp`, `ContactoNegocio`, el formulario Súmate, `solicitudes_negocio` y el evento `whatsapp` con `motivo` `negocio` siguen igual.
- Mensajes con `?ref=` o `?text=` en `m.me`, o un chat de Messenger incrustado en el sitio (plugin de chat de Meta).
- Editar `refugio.messenger` desde el panel: se edita en Studio, como el resto de `refugio`.
- Una cuenta de Messenger distinta según el motivo (adopciones a una, donativos a otra).
- Teléfono, correo de contacto o formulario de contacto propio.
- Migrar el historial de Umami del evento `whatsapp` al evento `mensaje`.
- Anuncios (SPEC 19, RF-18).

## Modelo de datos

```sql
-- supabase/migrations/2026100313xxxx_messenger_refugio.sql
alter table refugio add column messenger text;
update refugio set messenger = '100067644922613' where id = 'refugio';
alter table refugio
	alter column messenger set not null,
	add constraint refugio_messenger_valido check (messenger ~ '^[A-Za-z0-9.]{5,50}$');
alter table refugio drop column whatsapp;
```

- `messenger` es lo que va después de `m.me/`: el usuario de la página o su id numérico.
- El `update` de la migración dispara el deploy hook (la tabla `refugio` tiene su trigger), así que Producción se vuelve a compilar con el código nuevo justo después de `npx supabase db push`.

```ts
// src/content.config.ts, colección refugio
// Usuario o id de la página de Facebook, listo para m.me: "100067644922613".
messenger: z.string().regex(/^[A-Za-z0-9.]{5,50}$/),
```

```astro
<!-- Uso de EnlaceMessenger -->
<EnlaceMessenger
	mensaje={`Hola, quiero adoptar a ${nombre}. La vi en la página de ${refugio.nombre}.`}
	motivo="adopcion"
	extra={{ peludo: nombre }}
	class="…"
>
	Quiero adoptar a {nombre}
</EnlaceMessenger>
```

`EnlaceMessenger` genera esto:

```html
<a href="https://m.me/100067644922613" target="_blank" rel="noopener"
   data-mensaje="Hola, quiero adoptar a Rocky. …"
   data-umami-event="mensaje" data-umami-event-motivo="adopcion" data-umami-event-peludo="Rocky">
```

Props: `mensaje` (obligatorio), `motivo` (obligatorio), `extra` (opcional; cada clave se vuelve `data-umami-event-{clave}`) y `class`. Lee `refugio.messenger` con `obtenerRefugio()`.

`AvisoMensaje`:

- Un `<div role="status" aria-live="polite">` fijo y oculto, con el texto "Copiamos tu mensaje. Pégalo en Messenger para que sepamos de qué nos escribes."
- Un script nativo (sin Astro en `src/lib/`) con un solo listener de `click` en `document`. Al tocar un `[data-mensaje]` llama a `navigator.clipboard.writeText` en el mismo gesto, sin `preventDefault`. Si la copia funciona, muestra el aviso 6 s.
- Sin JS, sin `navigator.clipboard` o si la copia falla, el enlace abre Messenger igual y no aparece ningún aviso.
- El aviso usa la clase `aparecer` (ya se apaga con "reducir movimiento"). En `LayoutColabora` y en la ficha del peludo va arriba de la barra fija inferior, no encima de ella.

Umami: los clics de contacto con el refugio usan el evento `mensaje` con los mismos valores de `motivo`. El evento `whatsapp` queda solo para `motivo` `negocio` en `ContactoNegocio`.

## Plan de implementación

1. **Migración y datos.** Agregar `supabase/migrations/…_messenger_refugio.sql`. En `seed.sql`, cambiar `whatsapp` por `messenger` en `refugio` y "WhatsApp" por "Messenger" en `proceso-adopcion` y `pregunta-reservar`. Cambiar el esquema de `refugio` en `content.config.ts`. Agregar `src/lib/messenger.ts`. Sin pasar a Messenger todavía los botones, el sitio ya no compila porque leen `refugio.whatsapp`; por eso este paso va en el mismo commit que el 2. Prueba manual: `npx supabase db reset` sin errores, y `select messenger from refugio` da `100067644922613`.
2. **Componentes.** Crear `EnlaceMessenger.astro` y `AvisoMensaje.astro`, agregar `AvisoMensaje` en `Layout` y cambiar los 10 botones de la tabla del alcance, con sus textos. Prueba manual: con `astro dev`, en la ficha de un peludo, tocar "Quiero adoptar a…" abre `m.me/100067644922613` en otra pestaña, y en la pestaña del sitio aparece el aviso. Pegar en cualquier campo de texto da "Hola, quiero adoptar a …".
3. **Textos y panel.** Cambiar los textos de `Donativos`, `FormasDeAyudar` (con el aviso de perfiles falsos), `admin/campanas/editar` y `admin/index`. Prueba manual: `grep -rni whatsapp src` solo lista archivos de negocios (`colabora/`, `admin/negocios`, `admin/solicitudes`, `formularioPanel.ts`, `whatsapp.ts`), `content.config.ts` (esquema de negocios), `seo.ts` (`datosNegocio`) y `aviso-de-privacidad.astro` (WhatsApp de los negocios, solo con negocios visibles).
4. **Aviso de privacidad y SEO.** Cambiar la sección "WhatsApp" por "Messenger" y el párrafo de analítica en `aviso-de-privacidad.astro`, y quitar `telephone` en `datosRefugio` de `seo.ts`. Prueba manual: `astro build` y el JSON-LD de `dist/index.html` sin `telephone`.
5. **Documentación.** `CLAUDE.md` y `AGENTS.md`:
   - La lista de eventos de Umami: `mensaje` para el refugio y `whatsapp` solo para negocios.
   - Las entradas nuevas `EnlaceMessenger`, `AvisoMensaje` y `src/lib/messenger.ts`. `whatsapp.ts` queda descrito como solo para negocios.
   - La migración `messenger_refugio` en la descripción de `supabase/`.
   - En el estado, que la SPEC 17 ya no corrige el WhatsApp del refugio.

   En `specs/README.md`, la fila 18 y anuncios pasa a 19. En `specs/17-datos-reales-y-negocios-ocultos.md`, el paso 8 y el criterio de `whatsapp` quedan tachados con una nota que remite a esta spec.
6. **Nube** (después de fusionar a `main`). Correr `npx supabase db push`. El `update` de la migración vuelve a desplegar Producción. Prueba manual: el deploy termina en verde y, en https://www.ladridosdeesperanza.org, "Escríbenos por Messenger" abre el chat con SOS Ladridos de Esperanza Tenancingo desde un teléfono.
7. **Textos en la nube** (usuario, en `/admin/textos` de Producción). Cambiar "WhatsApp" por "Messenger" en "Cómo es el proceso de adopción" y en "¿Necesito reservar mi lugar?", y guardar. Si se hace junto con el paso 7 de la SPEC 17, quedan además como registros reales.

## Criterios de aceptación

- [x] `npx supabase db reset` aplica la migración sin errores y `refugio` ya no tiene la columna `whatsapp`.
- [x] `update refugio set messenger = 'a b'` falla por el check `refugio_messenger_valido`.
- [x] `astro build` y `npx astro check` terminan sin errores.
- [x] `grep -rn "wa.me" dist --include=*.html` sin `PUBLIC_MOSTRAR_NEGOCIOS` no da ningún resultado.
- [x] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, `grep -rli whatsapp dist --include=*.html --exclude-dir=admin` no da ningún resultado (el panel conserva textos de negocios ocultos).
- [x] Con `PUBLIC_MOSTRAR_NEGOCIOS=true`, las páginas de negocio con WhatsApp siguen teniendo su botón `wa.me` con el evento `whatsapp` y `motivo` `negocio`.
- [x] Los 10 botones de la tabla del alcance apuntan a `https://m.me/100067644922613` y llevan `data-umami-event="mensaje"` con su `motivo`.
- [x] Al tocar cualquiera de esos botones se abre `m.me` y el portapapeles queda con el mensaje de ese botón.
- [x] Al tocar un botón, el aviso "Copiamos tu mensaje…" aparece en la página del sitio y desaparece solo a los 6 s.
- [x] En la ficha de un peludo, el aviso no tapa la barra "Quiero adoptar a {nombre}".
- [x] Con JS desactivado, los botones abren `m.me` y no aparece ningún aviso.
- [x] El aviso tiene `role="status"` y un lector de pantalla lo anuncia.
- [x] `/donar` dice "Desconfía de perfiles que te escriban primero pidiendo dinero."
- [x] El aviso de privacidad tiene la sección "Messenger" y no menciona WhatsApp sin negocios visibles.
- [x] El JSON-LD de la portada no tiene `telephone` y sigue teniendo `sameAs` con las 4 redes.
- [x] En la nube, `select messenger from refugio` da `100067644922613` y la columna `whatsapp` no existe.
- [x] El deploy de Producción después de `npx supabase db push` termina en verde.
- [x] Desde un teléfono, "Escríbenos por Messenger" en https://www.ladridosdeesperanza.org abre el chat con SOS Ladridos de Esperanza Tenancingo.
- [x] En la nube, ningún `bloques_contenido` contiene "WhatsApp".

## Decisiones

- **Sí:** la página SOS Ladridos de Esperanza Tenancingo (`m.me/100067644922613`). Es la que contesta los mensajes. `ladridos.esperanza.5` parece un perfil personal.
- **Sí:** columna nueva `refugio.messenger`. Queda explícito qué cuenta recibe los mensajes y se cambia en Studio sin un commit.
- **No:** armar el enlace a partir de la URL de la red `facebook_sos` en `redes`. Las URL `/p/…` y `profile.php?id=` no se convierten de forma confiable al formato de `m.me`.
- **No:** una constante en el código. Cambiar de cuenta exigiría un commit.
- **Sí:** la migración llena `messenger` y lo hace obligatorio. Con un solo `db push` queda lista. Ningún botón queda sin destino.
- **Sí:** borrar `refugio.whatsapp`. Su valor era de relleno y dejar la columna invita a volver a usarla.
- **Sí:** copiar el mensaje al portapapeles y avisar. `m.me` no garantiza el mensaje prellenado, y sin él el refugio no sabe de qué peludo o campaña le escriben.
- **No:** `m.me/{cuenta}?text=`. Meta no lo documenta para páginas y, cuando no funciona, el chat se abre vacío sin que nadie lo note.
- **No:** `preventDefault` y abrir Messenger después del aviso. Un `window.open` diferido lo bloquea el navegador; sin JS el enlace normal sigue funcionando.
- **Sí:** un solo listener en `AvisoMensaje` para todos los `[data-mensaje]`. Un script por botón repetiría código en 10 componentes.
- **Sí:** el evento de Umami `mensaje`. El nombre `whatsapp` ya no diría la verdad, y su historial no vale nada porque el número era falso.
- **Sí:** "Escríbenos por Messenger". Nombra lo que se abre; "por Facebook" puede parecer que lleva al muro.
- **Sí:** advertir sobre perfiles falsos en `/donar`. En Facebook abundan las páginas que se hacen pasar por refugios para pedir dinero.
- **Sí:** quitar `telephone` del JSON-LD. El refugio no tiene teléfono. `sameAs` con las redes ya existía.
- **No:** tocar el WhatsApp de los negocios. Los negocios sí lo tienen y lo dan en Súmate.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Entre la fusión a `main` y el `db push`, Producción (y el Preview del PR) no compila porque `messenger` no existe en la nube | El `db push` va justo después de fusionar (paso 6). Mientras tanto Producción sirve el último deploy bueno. El PR se prueba en local, no en su Preview. Mismo patrón que la SPEC 16. |
| En el teléfono la app de Messenger se abre antes de que se vea el aviso | La copia ocurre en el mismo toque, antes de cambiar de app, así que el mensaje ya está en el portapapeles. El aviso queda visible al volver al sitio. |
| La página cambia de usuario o desactiva los mensajes y `m.me` deja de llevar al chat | Se cambia `refugio.messenger` en Studio y el trigger vuelve a desplegar. El último criterio de aceptación se prueba en un teléfono real. |
| En la computadora, messenger.com pide iniciar sesión | Es lo esperado: quien no tiene Facebook no puede escribir por Messenger. El refugio solo atiende por ahí. |
| El navegador niega el portapapeles (iframe, permisos, http) | No aparece el aviso y el enlace abre Messenger igual. El refugio pregunta en el chat. |

## Notas de implementación

- `FormularioSumate` también usaba `refugio.whatsapp` para su enlace de respaldo (sin JS o si falla el envío). Ahora lleva al Messenger del refugio; el enlace del error lleva `data-mensaje`, así que también copia el mensaje. El campo WhatsApp del negocio no cambia.
- `AvisoMensaje` no usa la clase `aparecer`: es una animación ligada al scroll (`animation-timeline: view()`) y no sirve para un elemento fijo. El aviso queda en el DOM vacío y transparente (`empty:opacity-0`), así el lector de pantalla anuncia el texto al llenarlo; al volver a tocar se vacía y se vuelve a llenar.
- `FichaCampana` y `portada/Esterilizacion` ya no leen `refugio`.
- Los criterios marcados se verificaron en local (Supabase local, `astro build` con y sin `PUBLIC_MOSTRAR_NEGOCIOS`, Chromium sin interfaz con portapapeles en 390 × 844). Los de la nube se verificaron el 2026-10-03 después de `npx supabase db push` y de corregir los dos textos en `/admin/textos`; la prueba en teléfono la hizo el usuario.

## Lo que **no** entra en esta spec

- El WhatsApp de los negocios y el formulario Súmate.
- `?ref=`, `?text=` o un chat de Meta incrustado.
- Editar `refugio.messenger` desde el panel.
- Una cuenta distinta por motivo.
- Teléfono, correo o formulario de contacto propio.
- Migrar el historial de Umami.
- Anuncios (SPEC 19).

Cada una, si llega, va en su propia spec.
