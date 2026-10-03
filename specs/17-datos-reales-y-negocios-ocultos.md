# SPEC 17 — Datos reales y negocios ocultos

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05, SPEC 07, SPEC 09, SPEC 11, SPEC 12
> **Fecha:** 2026-10-03
> **Objetivo:** Que el sitio publicado muestre solo los datos reales del refugio, sin el listón "Datos de ejemplo", y que todo lo de negocios quede oculto detrás de un interruptor hasta que el refugio tenga esa información.

## Por qué existe esta spec

Producción y los Previews compilan con `PUBLIC_MOSTRAR_EJEMPLOS=true`, así que el sitio real muestra el listón "Datos de ejemplo" y registros inventados. En la nube (3 de octubre de 2026) casi todo es de ejemplo:

| Tabla | De ejemplo | Reales |
| --- | --- | --- |
| `refugio` | 1 | 0 |
| `peludos` | 1 | 1 |
| `campanas` | 0 | 1 |
| `necesidades` | 3 | borradores de Facebook |
| `bloques_contenido` | 9 | 0 |
| `problematicas` | 8 | 0 |
| `destinos_donativo` | 5 | 0 |
| `categorias` | 5 | 0 |
| `negocios` | 5 | 0 |
| `redes` | 0 | 4 |

Sin el registro real de `refugio`, quitar la variable rompe la compilación (es a propósito, SPEC 01). Por eso primero se corrigen los registros que sí sirven y luego se quita la variable.

El refugio todavía no tiene negocios que colaboren. "Come por los Peludos" sin negocios es una promesa vacía: el menú, la sección de la portada, la tarjeta de `/donar`, el formulario Súmate, el aviso de privacidad y el panel hablan de algo que no existe. Se oculta todo con un solo interruptor y queda documentado cómo volver a mostrarlo.

## Alcance

**Dentro:**

- Variable nueva `PUBLIC_MOSTRAR_NEGOCIOS`. Solo con el valor `true` se muestra lo de negocios. Sin ella (Producción y Previews) se oculta todo lo de la lista siguiente.
- Con negocios ocultos, en el sitio público:
  - El menú del encabezado no tiene "Negocios que ayudan".
  - La portada no tiene la sección `Colaboracion` (queda con 7 secciones).
  - `/donar` no tiene la tarjeta "Come en negocios que ayudan".
  - `/colabora` y `/colabora/sumate` redirigen a `/`.
  - No se genera ninguna página `/colabora/{negocio}`: esas URL dan la 404 del sitio.
  - El sitemap no lista ninguna URL de `/colabora`.
  - El aviso de privacidad no habla de negocios ni del formulario Súmate.
- Con negocios ocultos, en el panel (para el administrador):
  - `EncabezadoPanel` no tiene los enlaces Negocios, Categorías, Solicitudes ni QR.
  - `/admin` no tiene las tarjetas de Negocios, Categorías, Solicitudes y QR de negocios, ni el conteo de solicitudes nuevas.
  - `/admin/negocios`, `/admin/negocios/editar`, `/admin/negocios/menu`, `/admin/categorias`, `/admin/categorias/editar`, `/admin/solicitudes` y `/admin/qr` redirigen a `/admin`.
- La sección "Lo que enfrenta un refugio" de la portada no se muestra si no hay ninguna problemática publicada (hoy deja el título sin tarjetas).
- `docs/mostrar-negocios.md`: el plan para volver a mostrar los negocios.
- Lista de corrección de datos (pasos 7 a 9 del plan): qué registro de ejemplo corregir, dónde y cómo volverlo real. La hace el usuario en el panel y en Studio, no el código.
- SQL de una sola vez que borra de la nube los registros que siguen con `es_ejemplo = true` después de la corrección.
- Quitar `PUBLIC_MOSTRAR_EJEMPLOS` de Vercel en Production y en Preview: el listón y los ejemplos dejan de verse en los dos.
- `.env.example`, `CLAUDE.md`, `AGENTS.md` y `specs/README.md` al día: esta spec es la 17 y anuncios pasa a la 18.

**Fuera de alcance (specs futuras):**

- Borrar el código de `/colabora`, del panel de negocios o del editor de menús: todo se queda, solo se oculta.
- Quitar el permiso de insertar en `solicitudes_negocio` o cualquier otro cambio de RLS: el formulario no se ve, pero la base no cambia.
- Borrar de Storage las imágenes de los registros de ejemplo borrados (logos y fotos de ejemplo). No salen en ningún lado y pesan poco.
- Panel para editar `refugio`, `problematicas` o `destinos_donativo`: se siguen editando en Studio.
- Cambiar el mecanismo de `es_ejemplo` o el listón `CintaEjemplo`: siguen igual para desarrollo local.
- Revisión legal del aviso de privacidad (sigue pendiente).
- Logo y fotos de peludos en resolución original (siguen en "Antes de publicar").
- Anuncios (SPEC 18, RF-18).

## Modelo de datos

Esta spec no agrega tablas, columnas ni migraciones. Agrega una variable de entorno y una constante.

```ts
// src/lib/datos.ts
export const mostrarNegocios: boolean = import.meta.env.PUBLIC_MOSTRAR_NEGOCIOS === 'true';
```

```
# .env.example
# true → se ven /colabora, Súmate, la sección de la portada, la tarjeta de /donar y el panel de negocios.
# Sin la variable (Producción y Previews) todo eso se oculta y /colabora redirige a /. Ver docs/mostrar-negocios.md.
PUBLIC_MOSTRAR_NEGOCIOS=true
```

`astro.config.mjs` lee la misma variable con `loadEnv` para el filtro del sitemap. La variable es opcional: sin ella la compilación no falla, solo oculta.

En desarrollo local `.env` lleva `PUBLIC_MOSTRAR_EJEMPLOS=true` y `PUBLIC_MOSTRAR_NEGOCIOS=true`, así se siguen probando los negocios con los datos de `seed.sql`. En Vercel ninguna de las dos existe.

## Plan de implementación

1. **Interruptor y sitio público.** `mostrarNegocios` en `src/lib/datos.ts` y la variable en `.env.example`. Con `false`:
   - `Encabezado` omite el enlace "Negocios que ayudan".
   - `src/pages/index.astro` omite `<Colaboracion />`.
   - `donar/FormasDeAyudar` omite la tarjeta "Come en negocios que ayudan".
   - `colabora/index.astro` y `colabora/sumate.astro` devuelven `Astro.redirect('/')`.
   - `getStaticPaths` de `colabora/[slug].astro` devuelve `[]`.
   - El filtro del sitemap en `astro.config.mjs` descarta las URL que empiezan con `/colabora`.
   Prueba manual: `astro build` con la variable en `true` genera `/colabora` y las páginas de negocio como hoy; sin ella, `dist/colabora/index.html` es una redirección a `/` y `dist/sitemap-0.xml` no tiene `/colabora`.
2. **Panel.** Con `false`, `EncabezadoPanel` y `admin/index.astro` omiten los enlaces y tarjetas de Negocios, Categorías, Solicitudes y QR, y el script de `/admin` no consulta `solicitudes_negocio`. Las páginas `admin/negocios*`, `admin/categorias*`, `admin/solicitudes` y `admin/qr` devuelven `Astro.redirect('/admin')`. Prueba manual: entrar como `admin@ejemplo.test` con la variable en `true` y sin ella.
3. **Aviso de privacidad.** Con `false`, `aviso-de-privacidad.astro` omite los párrafos del formulario Súmate (datos, finalidad, conservación y derechos ARCO de los negocios) y quita "a los negocios" de la lista de clics que mide la analítica. El resto del aviso no cambia.
4. **Problemáticas vacías.** `portada/Problematicas` no se renderiza si `problematicasPublicadas()` está vacía. Prueba manual: con `PUBLIC_MOSTRAR_EJEMPLOS` vacío en local, la portada no tiene el título "Lo que enfrenta un refugio todos los días" sin tarjetas.
5. **Plan para restablecer.** `docs/mostrar-negocios.md` con:
   1. Cargar las categorías reales en `/admin/categorias` y al menos un negocio con su menú en `/admin/negocios` (en local o en un Preview con la variable activa).
   2. Agregar `PUBLIC_MOSTRAR_NEGOCIOS=true` en Vercel (Production y Preview).
   3. Volver a desplegar Production (guardar en el panel o "Redeploy" en Vercel).
   4. Revisar el menú, la portada, `/donar`, `/colabora`, `/colabora/sumate`, el sitemap y el aviso de privacidad.
   5. Imprimir los QR desde `/admin/qr` solo después de ver la página del negocio publicada.
   Y cómo volver a ocultarlos: quitar la variable y volver a desplegar.
6. **Documentación.** `CLAUDE.md` y `AGENTS.md` (estado, variable nueva, sección de la portada que puede faltar, Vercel sin `PUBLIC_MOSTRAR_EJEMPLOS`), `specs/README.md` (fila 17, anuncios pasa a 18) y `.env.example`. Hasta aquí todo se puede fusionar a `main`: Vercel todavía tiene `PUBLIC_MOSTRAR_EJEMPLOS=true` y no tiene `PUBLIC_MOSTRAR_NEGOCIOS`, así que Producción ya oculta los negocios y sigue mostrando los ejemplos.
7. **Corrección de datos en el panel** (usuario, en Producción). Guardar en el panel vuelve real el registro (`es_ejemplo = false`):
   - `/admin/textos`: los 9 bloques. Reescribir el texto de los que dicen "Texto de ejemplo", "Respuesta de ejemplo" o "Aquí irá la historia real del refugio" y guardarlos; un bloque que no aplica se borra.
   - `/admin/necesidades`: las 3 de ejemplo (croquetas, medicinas, cobijas). Guardar las que sí necesita el refugio con su vigencia real; las demás se dejan para el paso 9.
   - `/admin/peludos`: el peludo de ejemplo se guarda solo si es un peludo real del refugio con sus fotos reales.
8. **Corrección de datos en Studio** (usuario, proyecto `oszxkkjnwxuztmbrmvja`). Aquí `es_ejemplo` se cambia a `false` a mano en cada fila corregida:
   - `refugio`: `whatsapp` real (hoy `5215500000000`), `direccion` real (hoy "Calle de ejemplo 1, col. Centro"), `frase`, `ubicacion`. `latitud`, `longitud` y `enlace_mapa` ya son del refugio. Luego `es_ejemplo = false`.
   - `problematicas`: en cada una, corregir `texto` y, si la cifra no es real, dejar `etiqueta_cifra`, `cifra`, `fecha_cifra` y `fuente` en `null` (la tarjeta queda solo con título y texto). Luego `es_ejemplo = false`. Las que no apliquen se dejan para el paso 9.
   - `destinos_donativo`: corregir `monto` y `equivalencia` con montos que el refugio confirme. Luego `es_ejemplo = false`.
   - `redes` ya son reales; no se tocan.
   Prueba manual: `select count(*) from refugio where not es_ejemplo` da 1.
9. **Borrar los sobrantes** (usuario o Claude con permiso, en la nube). En una transacción, `delete from … where es_ejemplo` en todas las tablas con esa columna, respetando las llaves foráneas: primero `negocios` (con su menú, horarios, turnos y promoción) y `solicitudes_negocio`, luego `categorias`; `peludos` (con `hitos_peludo` y `me_gusta`), `campanas`, `necesidades`, `publicaciones_facebook`, `bloques_contenido`, `problematicas`, `destinos_donativo`, `registros_cifras` y `anuncios`. Nunca `refugio` ni `redes` si siguen con `es_ejemplo = true`: en ese caso se detiene y se vuelve al paso 8. El SQL se corre a mano una sola vez; no es una migración y `seed.sql` no cambia.
10. **Quitar los ejemplos de Vercel.** Borrar `PUBLIC_MOSTRAR_EJEMPLOS` de Production y de Preview y volver a desplegar Production. Prueba manual: https://www.ladridosdeesperanza.org sin listón y el deploy en verde.

## Criterios de aceptación

- [ ] `astro build` sin `PUBLIC_MOSTRAR_NEGOCIOS` termina sin errores.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, el menú del encabezado no tiene "Negocios que ayudan" en ningún tamaño de pantalla.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, la portada no tiene la sección de colaboración ni ningún enlace a `/colabora`.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, `/donar` no tiene la tarjeta "Come en negocios que ayudan".
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, abrir `/colabora` y `/colabora/sumate` lleva a `/`.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, `dist/` no tiene ninguna página `colabora/{negocio}`.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, `sitemap-0.xml` no tiene ninguna URL con `/colabora`.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, `grep -rl "/colabora" dist --include=*.html` solo lista `dist/colabora/index.html` y `dist/colabora/sumate/index.html` (las redirecciones).
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, el aviso de privacidad no contiene "Súmate" ni "tu negocio".
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, el administrador no ve Negocios, Categorías, Solicitudes ni QR en el encabezado del panel ni en `/admin`.
- [ ] Sin `PUBLIC_MOSTRAR_NEGOCIOS`, abrir `/admin/negocios`, `/admin/categorias`, `/admin/solicitudes` o `/admin/qr` lleva a `/admin`.
- [ ] Con `PUBLIC_MOSTRAR_NEGOCIOS=true`, todo lo anterior se ve y funciona igual que antes de esta spec.
- [ ] Sin problemáticas publicadas, la portada no tiene el título "Lo que enfrenta un refugio todos los días".
- [ ] `docs/mostrar-negocios.md` existe con los pasos para mostrar y para volver a ocultar los negocios.
- [ ] En la nube, ninguna tabla con `es_ejemplo` tiene filas con `es_ejemplo = true`.
- [ ] En la nube, `refugio` tiene exactamente un registro con `es_ejemplo = false` y su `whatsapp` no es `5215500000000`.
- [ ] Vercel no tiene `PUBLIC_MOSTRAR_EJEMPLOS` en Production ni en Preview.
- [ ] https://www.ladridosdeesperanza.org no muestra el listón "Datos de ejemplo".
- [ ] El último deploy de Production después del paso 10 terminó en verde.
- [ ] En local con `.env` copiado de `.env.example`, el sitio sigue mostrando los ejemplos, el listón y los negocios.

## Decisiones

- **Sí:** un solo interruptor `PUBLIC_MOSTRAR_NEGOCIOS` para el sitio, el aviso y el panel. Restablecer es poner la variable y volver a desplegar.
- **No:** ocultar automáticamente cuando no hay negocios publicados. Con el panel de negocios oculto nunca se podría publicar el primero, así que nunca reaparecería.
- **No:** una constante en el código. Obligaría a un commit para mostrar los negocios.
- **No:** borrar el código de negocios. Está terminado (SPEC 04, 05, 07, 09 y 10) y se va a usar.
- **Sí:** `/colabora` y `/colabora/sumate` redirigen a la portada. Nadie ve un error si llega por un enlace viejo.
- **Sí:** las páginas de cada negocio dan la 404. En un sitio estático no se puede redirigir una URL que no se genera, y no hay ningún negocio real ni QR impreso de uno.
- **No:** redirecciones en `vercel.json`. No pueden depender de la variable y seguirían activas al mostrar los negocios.
- **Sí:** convertir los registros de ejemplo que sirven en lugar de cargar todo desde cero. El registro de `refugio` ya tiene la ubicación y el mapa reales, y las redes ya son reales.
- **Sí:** el usuario corrige los datos en el panel y en Studio. La spec dice qué corregir; el código no inventa datos del refugio.
- **Sí:** borrar de la nube los registros que no se confirmen. Dejarlos ocultos ensuciaría el panel y la comparación de necesidades de la sincronización con Facebook. `seed.sql` los conserva para local.
- **No:** una migración para borrar los ejemplos. Es una limpieza de datos de una sola vez, no un cambio de esquema.
- **Sí:** quitar los ejemplos también en Previews. Un Preview se ve igual que Producción; los ejemplos se prueban en local.
- **Sí:** ocultar la sección de problemáticas cuando está vacía. Después del borrado puede quedar sin registros y no debe quedar un título sin contenido.
- **No:** quitar el permiso de `solicitudes_negocio`. El formulario no se ve; tocar RLS es otro cambio con su propio riesgo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Se quita `PUBLIC_MOSTRAR_EJEMPLOS` antes de tener el `refugio` real y la compilación falla | El paso 10 va después del 8. El paso 9 se detiene si `refugio` sigue de ejemplo. Si pasa, Production sigue sirviendo el último deploy bueno. |
| El borrado del paso 9 se corre contra la base local o borra algo real | El SQL solo toca filas con `es_ejemplo = true`, va en una transacción y se revisan los conteos antes del `commit`. |
| Una llave foránea impide el borrado | El orden del paso 9 sigue las llaves; si falla, la transacción no deja nada a medias. |
| Algún enlace a `/colabora` quedó fuera de la lista y lleva a la portada sin aviso | Criterio de aceptación: buscar `/colabora` en el HTML de `dist/` sin la variable; solo deben aparecer las páginas de redirección. |
| Un Preview sin ejemplos se ve vacío en partes (necesidades, campañas) | Es lo esperado: muestra lo mismo que Producción. Los ejemplos se prueban en local. |

## Lo que **no** entra en esta spec

- Borrar el código de negocios, menús o Súmate.
- Cambios de RLS o de esquema.
- Limpieza de imágenes de ejemplo en Storage.
- Panel para `refugio`, `problematicas` o `destinos_donativo`.
- Revisión legal del aviso de privacidad.
- Logo y fotos en resolución original.
- Anuncios (SPEC 18).

Cada una, si llega, va en su propia spec.
