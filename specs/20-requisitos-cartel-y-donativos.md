# SPEC 20 — Requisitos de adopción, cartel en la portada y donativos del refugio

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 12, SPEC 13, SPEC 14, SPEC 18
> **Fecha:** 2026-10-03
> **Objetivo:** Publicar los requisitos reales de adopción, poner el cartel de la próxima campaña de esterilización en el carrusel de la portada, decir qué se recibe siempre en especie y cambiar el apadrinamiento por "Apadrina una esterilización".

## Por qué existe esta spec

El refugio compartió su cartel "Requisitos de adopción Ladridos de Esperanza Tenancingo". Pide cuatro cosas: copia de comprobante de domicilio, copia de INE/IFE, llenar el formato de adopción y un donativo en especie o económico. El sitio no los dice en ningún lado: el bloque `proceso_adopcion` solo explica los pasos.

Además salieron tres ajustes del refugio:

1. La campaña del 10 de octubre de 2026 ya tiene cartel en la nube, pero en la portada solo se ve en `/esterilizacion`. Debe aparecer arriba, en el carrusel de fotos del refugio.
2. En especie, el refugio siempre recibe croquetas de cualquier marca para perros y gatos, artículos de limpieza y arena para gatos. Hoy el texto fijo dice "Croquetas, medicinas, cobijas y artículos de limpieza" y en la portada solo aparece cuando no hay necesidades vigentes.
3. El apadrinamiento no es un aporte mensual por peludo. Lo que se apadrina es una esterilización: se dona su costo por depósito o en efectivo en el refugio y se avisa que es para esterilizar a un peludo del refugio. Esto también cierra el pendiente "Confirmar con el refugio cómo funcionan el apadrinamiento…" de `specs/README.md` en lo que toca al apadrinamiento.

## Alcance

**Dentro:**

- Componente nuevo `src/components/adopta/RequisitosAdopcion.astro` con los cuatro requisitos, en texto fijo:
  - En `/adopta`, como sección completa entre `GaleriaPeludos` y `ProcesoAdopcion`, con `id="requisitos"`.
  - En la ficha `/adopta/{id}`, en versión compacta, justo antes del enlace "¿Cómo es adoptar?".
- `CarruselRefugio`: si `proximaCampana(hoy)` tiene cartel, el cartel es la primera diapositiva y enlaza a `/esterilizacion`. Sin campaña próxima o sin cartel, el carrusel queda como hoy (9 fotos).
- Donar en especie: una línea fija "Siempre recibimos…" en `portada/Donativos` y en `donar/FormasDeAyudar`, que se muestra siempre. La lista de necesidades vigentes del panel sigue debajo.
- `donar/FormasDeAyudar`: la tarjeta "Apadrina a un peludo" pasa a "Apadrina una esterilización", con el costo de la próxima campaña cuando existe y un mensaje nuevo para Messenger.
- `specs/README.md`, `CLAUDE.md` y `AGENTS.md` al día. Esta spec es la 20 y anuncios pasa a la 21.

**Fuera de alcance (specs futuras):**

- Editar los requisitos, la línea "Siempre recibimos" o el texto de apadrinamiento desde el panel: están en código y cambiarlos es un commit.
- Publicar el formato de adopción como archivo para descargar o llenar en línea.
- Un monto fijo o sugerido para el donativo de adopción.
- Cambiar el texto del bloque `proceso_adopcion` en la nube o en `seed.sql`.
- Publicar datos bancarios: siguen pidiéndose por Messenger (SPEC 18).
- Dar de alta, editar o borrar necesidades en la nube.
- Apadrinamiento mensual de un peludo concreto, o ligar una esterilización apadrinada a un peludo desde el sitio (el hito de esterilización con su padrino ya existe en el panel, SPEC 13).
- El cartel en otro lugar de la portada (la sección `Esterilizacion`), el cartel de la campaña anterior en el carrusel, o ampliarlo en un `<dialog>` desde la portada.
- La tarjeta de voluntariado y sus condiciones.
- Anuncios (SPEC 21, RF-18).

## Modelo de datos

Esta spec no agrega tablas, columnas, migraciones ni colecciones, y `seed.sql` no cambia. Usa `campanas.cartel` y `campanas.costo` a través de `proximaCampana()` de `src/lib/datos.ts`.

Requisitos (lista fija en `RequisitosAdopcion.astro`, en este orden):

| Ícono (Lucide) | Texto |
| --- | --- |
| `house` | Copia de comprobante de domicilio |
| `id-card` | Copia de INE/IFE |
| `clipboard-pen` | Llenar el formato de adopción |
| `hand-heart` | Donativo en especie o económico |

- Prop `compacto` (por omisión `false`).
- Completo (`/adopta`): `<section id="requisitos" aria-labelledby="requisitos-titulo">` con el `<h2>` "Requisitos para adoptar", la frase "Ten listo esto para tu visita al refugio." y una `<ul>` con un renglón por requisito (ícono y texto). Debajo del cuarto requisito, el enlace "Ve qué le hace falta al refugio" a `/donar`. Mismo marco que `ProcesoAdopcion`: `scroll-mt-4 rounded-3xl bg-suave p-5 md:p-8`.
- Compacto (ficha): `<section aria-labelledby="requisitos-titulo">` con `mt-8`, el `<h2>` "Requisitos para adoptar" (`text-2xl font-bold`, como "Su historia") y la misma `<ul>` sin la frase ni el enlace a `/donar`.
- El texto no dice dónde se llena el formato.

Cartel en el carrusel (`CarruselRefugio.astro`):

- `const campana = await proximaCampana(new Date())` y `cartel = campana?.data.cartel ?? null`.
- Con cartel, la primera `<li>` envuelve un `<a href="/esterilizacion">` que ocupa toda la diapositiva. Dentro van, igual que las fotos, el fondo difuminado (`aria-hidden`, `alt=""`) y el cartel completo con `object-contain`. Ambos son `<Image>` remotos con `medidas()` de `src/lib/imagenes.ts`: 48 px el fondo y 1280 px el cartel.
- `alt` del cartel: `Cartel de la campaña de esterilización del {formatearFecha(fecha)}`. El enlace no necesita texto aparte: el `alt` es su nombre.
- El cartel lleva `loading="eager"` y `fetchpriority="high"`. La primera foto del refugio pasa a `loading="lazy"` sin `fetchpriority`.
- `total` y los puntos cuentan el cartel: 10 diapositivas con cartel. El punto del cartel dice "Ver cartel de la campaña". Los de las fotos siguen diciendo "Ver foto {n}", con `n` de 1 a 9.
- Con 10 puntos de `w-6` más dos flechas de `size-11` caben 328 px, dentro de los 328 px útiles a 360 px de ancho (16 px de margen por lado). Si no caben al probarlo, los puntos pasan a `w-5` en todos los casos.
- Atributos de Umami: `data-umami-event="abrir_campana"` y `data-umami-event-origen="carrusel"`.
- La portada se compila de nuevo al guardar una campaña (trigger de `campanas`) y cada día a las 00:05 (`pg_cron`). Así, el día después de la campaña el cartel desaparece del carrusel.

Línea "Siempre recibimos" (igual en las dos tarjetas de especie):

> Siempre recibimos croquetas de cualquier marca para perros y gatos, arena para gatos y artículos de limpieza.

- `portada/Donativos`: la línea va siempre, debajo de "Dona en especie". Si hay necesidades vigentes, debajo va `ListaNecesidades`. Si no, va "Escríbenos y te decimos qué más hace falta." en lugar del texto fijo actual.
- `donar/FormasDeAyudar`: reemplaza "Croquetas, medicinas, cobijas y artículos de limpieza. Mira lo que hace falta este mes." por la línea más "Mira lo que hace falta este mes." `ListaNecesidades` sigue igual.

"Apadrina una esterilización" (`donar/FormasDeAyudar`):

- Ícono `hand-heart` y `<h3>` "Apadrina una esterilización".
- Texto con campaña próxima: "Dona lo que cuesta una esterilización ({formatearPesos(costo)} en la próxima campaña) para que un peludo del refugio se esterilice. Puedes depositar o entregarlo en efectivo en el refugio; avísanos que es para esterilizar a un peludo del refugio."
- Texto sin campaña próxima: "Dona lo que cuesta una esterilización para que un peludo del refugio se esterilice. Puedes depositar o entregarlo en efectivo en el refugio; avísanos que es para esterilizar a un peludo del refugio."
- Botón `EnlaceMessenger` "Quiero apadrinar una esterilización", con `motivo` `apadrinar` (el mismo de hoy) y el mensaje `Hola, quiero apadrinar la esterilización de un peludo de ${refugio.nombre}. ¿Cómo hago el depósito o dónde lo entrego?`.

## Plan de implementación

1. **Requisitos en `/adopta`.** Crear `RequisitosAdopcion.astro` (versión completa) y ponerlo en `src/pages/adopta.astro` entre `GaleriaPeludos` y `ProcesoAdopcion`. Agregar "Requisitos" al comentario de la página. Prueba manual: con `astro dev`, `/adopta#requisitos` muestra los cuatro requisitos con sus íconos, y el enlace lleva a `/donar`.
2. **Requisitos en la ficha.** Agregar la prop `compacto` y ponerlo en `src/pages/adopta/[id].astro` después de `CaminoPeludo` y antes de "¿Cómo es adoptar?". Prueba manual: la ficha de un peludo muestra "Requisitos para adoptar" con los cuatro renglones, y la barra fija no tapa el último a 360 px.
3. **Cartel en el carrusel.** Cambiar `CarruselRefugio.astro` como dice el modelo de datos y actualizar su comentario y el de `Presentacion.astro`. Prueba manual: con la campaña de ejemplo con cartel en local, el carrusel arranca en el cartel, tiene 10 puntos y tocarlo abre `/esterilizacion`. Sin cartel en la campaña próxima (`cartel_id` en `null` en local y reiniciar `astro dev`), vuelven las 9 fotos y la primera carga con `eager`. A 360 px no hay desplazamiento horizontal de la página.
4. **Siempre recibimos.** Cambiar las tarjetas de especie de `portada/Donativos` y `donar/FormasDeAyudar`. Prueba manual: la línea se ve en la portada y en `/donar`, haya o no necesidades vigentes.
5. **Apadrina una esterilización.** Reemplazar la tarjeta en `donar/FormasDeAyudar` con `proximaCampana(new Date())`, y actualizar el comentario del componente. Prueba manual: con campaña próxima el texto dice su costo con `formatearPesos`. Sin ella no hay monto. El botón abre Messenger y copia el mensaje nuevo.
6. **Documentación.**
   - `CLAUDE.md` y `AGENTS.md`:
     - `adopta/` suma `RequisitosAdopcion` (`id="requisitos"`, completo en `/adopta` y compacto en la ficha).
     - `CarruselRefugio` arranca con el cartel de la próxima campaña cuando lo hay.
     - En la analítica, el evento nuevo `abrir_campana` con `origen` `carrusel`.
     - `apadrinar` sigue en `donar/FormasDeAyudar`, ahora para una esterilización.
     - "SPEC 20" de anuncios pasa a "SPEC 21".
   - `specs/README.md`:
     - Fila 20 para esta spec y fila 21 para anuncios.
     - "Pendiente de decidir" pasa a la 21.
     - En "Antes de publicar", el pendiente de apadrinamiento y voluntariado queda solo para el voluntariado.

## Criterios de aceptación

- [x] `astro build` y `npx astro check` terminan sin errores.
- [x] `/adopta` tiene una sección `#requisitos` entre la galería y el proceso, con "Copia de comprobante de domicilio", "Copia de INE/IFE", "Llenar el formato de adopción" y "Donativo en especie o económico", en ese orden, y un enlace a `/donar`.
- [x] Cada ficha `/adopta/{id}` muestra "Requisitos para adoptar" con los mismos cuatro textos, antes de "¿Cómo es adoptar?".
- [x] Con una campaña `proxima` vigente con cartel, la primera diapositiva del carrusel de la presentación es el cartel, enlaza a `/esterilizacion` y su `alt` empieza con "Cartel de la campaña de esterilización del".
- [x] Con cartel, el carrusel tiene 10 diapositivas y 10 puntos, y el primer punto dice "Ver cartel de la campaña".
- [x] El enlace del cartel lleva `data-umami-event="abrir_campana"` y `data-umami-event-origen="carrusel"`.
- [x] Sin campaña próxima, o con una sin cartel, el carrusel tiene 9 diapositivas y ningún enlace a `/esterilizacion`.
- [x] El cartel de una campaña `pasada` nunca aparece en el carrusel.
- [x] A 360 px de ancho, la portada no tiene desplazamiento horizontal y los 10 puntos y las dos flechas caben en una línea.
- [x] La portada y `/donar` dicen "Siempre recibimos croquetas de cualquier marca para perros y gatos, arena para gatos y artículos de limpieza.", con y sin necesidades vigentes.
- [x] `dist/` no contiene "Croquetas, medicinas, cobijas y artículos de limpieza".
- [x] `/donar` tiene la tarjeta "Apadrina una esterilización" y no tiene "Apadrina a un peludo" ni "aporte cada mes".
- [x] Con campaña próxima, la tarjeta de apadrinar muestra su costo (hoy "$380"); sin ella no muestra ningún monto.
- [x] El botón "Quiero apadrinar una esterilización" lleva `data-umami-event-motivo="apadrinar"` y un `data-mensaje` que dice "apadrinar la esterilización".
- [x] `/donar` sigue sin publicar ningún dato bancario.
- [x] Ninguna migración nueva en `supabase/migrations/` y `seed.sql` sin cambios.

## Decisiones

- **Sí:** requisitos en texto fijo. Son cuatro y cambian muy rara vez, así que un commit basta.
- **No:** bloque editable `requisitos_adopcion` en el panel. Pediría una migración del check de secciones y una entrada en `secciones.ts` por una lista que casi no cambia.
- **No:** meter los requisitos en el texto del bloque `proceso_adopcion`. Mezcla pasos con documentos, y nada impediría que se borraran al editar el proceso.
- **Sí:** requisitos en `/adopta` y en la ficha. Quien decide adoptar a un peludo concreto está en su ficha y tiene que ver qué llevar sin salir de ahí.
- **Sí:** "Llenar el formato de adopción" sin decir dónde. El refugio no lo dijo y la spec no lo inventa.
- **Sí:** enlace a `/donar` debajo del donativo de adopción. Responde "¿qué llevo?" con las necesidades vigentes sin fijar un monto.
- **Sí:** el cartel como primera diapositiva que enlaza a `/esterilizacion`. Es lo primero que se ve y allá están la ficha completa, "Reservar mi lugar" y el cartel ampliable.
- **No:** ampliar el cartel en un `<dialog>` desde la portada. Duplicaría `VisorCartel` y dejaría a la persona sin los datos de la campaña.
- **No:** el cartel al final del carrusel. Casi nadie llega a la décima diapositiva.
- **Sí:** solo el cartel de `proximaCampana`. El de la campaña anterior solo tiene sentido en `/esterilizacion`, con su leyenda.
- **Sí:** evento `abrir_campana` con `origen` `carrusel`. Mide si el cartel lleva gente a la campaña. `origen` deja abierto medirlo después desde otro lugar.
- **Sí:** "Siempre recibimos" fijo y visible siempre. Son cosas que el refugio necesita todo el año y no deben vencer como una necesidad.
- **No:** dar esos artículos de alta como necesidades. Vencen con su fecha y competirían con las que llegan de Facebook (SPEC 16).
- **Sí:** reemplazar el apadrinamiento mensual. El refugio dijo que lo que se apadrina es la esterilización, y mantener las dos ofrecería algo que el refugio no confirmó.
- **Sí:** el monto es el costo de la próxima campaña. Es una cifra que el refugio publica y se actualiza sola con cada campaña. El refugio confirmó que apadrinar cuesta lo mismo que esterilizar una mascota propia.
- **No:** monto fijo en código. Se desactualizaría sin que nadie lo note.
- **Sí:** efectivo "en el refugio" y depósito con los datos por Messenger. Sigue la regla de no publicar cuentas bancarias (SPEC 03 y 18).
- **Sí:** se conserva el `motivo` `apadrinar`. El historial de Umami sigue comparable.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El cartel de la campaña sigue en la portada después de su fecha si el deploy diario falla. | `proximaCampana` filtra por fecha al compilar y el cron de las 00:05 compila cada día. El mismo riesgo ya existe en la sección de esterilización. |
| Un cartel vertical se ve chico dentro del marco cuadrado. | Va completo con `object-contain` sobre su fondo difuminado, igual que las fotos verticales del refugio. Tocarlo lleva al cartel ampliable de `/esterilizacion`. |
| 10 puntos más las flechas no caben a 360 px. | El paso 3 lo prueba. Si no caben, los puntos pasan a `w-5`. |
| El cartel pesa más que una foto y es la imagen principal de la portada. | `<Image>` lo optimiza a WebP con `widths` como las fotos, y la primera foto del refugio deja de cargar con prioridad. |

## Lo que **no** entra en esta spec

- Requisitos, "Siempre recibimos" o apadrinamiento editables desde el panel.
- El formato de adopción como archivo o formulario en línea.
- Cambiar el bloque `proceso_adopcion` o las necesidades de la nube.
- Datos bancarios en el sitio.
- Apadrinamiento mensual o ligado a un peludo concreto.
- El cartel en otros lugares de la portada o ampliable desde ella.
- Voluntariado.
- Anuncios (SPEC 21).

Cada uno, si llega, va en su propia spec.
