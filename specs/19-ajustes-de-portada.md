# SPEC 19 — Ajustes de portada: ubicación en Maps, "Ver a todos", carrusel aleatorio y sin cifras

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 12, SPEC 13, SPEC 14, SPEC 17
> **Fecha:** 2026-10-03
> **Objetivo:** Corregir cuatro detalles de la portada: la ubicación abre el refugio en Google Maps, "Ver a todos" se vuelve un botón visible, el carrusel de peludos sale en orden aleatorio y "Lo que enfrenta un refugio todos los días" deja de mostrar cifras.

## Por qué existe esta spec

Son cuatro arreglos chicos de la portada que salieron al revisar el sitio en producción:

1. El texto "Tenancingo, Estado de México" con el ícono `map-pin` de la presentación parece un enlace a un mapa, pero solo baja a `#quienes`. El refugio ya tiene `enlace_mapa` en la nube (su ficha de Google Maps), así que el enlace puede abrirla.
2. "Ver a todos", debajo del carrusel de `#adopta`, es un enlace subrayado chico y casi no se ve.
3. El carrusel sigue el `orden` del panel, así que los primeros peludos dados de alta salen siempre primero y reciben más atención.
4. Las 8 tarjetas de `problematicas` se marcaron como reales en la SPEC 17, pero 7 muestran cifras ("120 rescates por año", "$8,000", "60 de 70 lugares"…) con la fuente "Registro del refugio" que nadie confirmó. El sitio no debe mostrar datos que no se pueden verificar.

## Alcance

**Dentro:**

- `portada/Presentacion`: la ubicación lleva a `enlaceMapaRefugio(refugio)` en otra pestaña, con el evento de Umami `como_llegar` y `origen` `presentacion`. Si el refugio no tiene ni `enlace_mapa` ni coordenadas, sigue bajando a `#quienes` como hoy.
- `portada/Adopciones`: "Ver a todos" pasa a ser el botón "Ver a todos los peludos", relleno de acento y centrado debajo del carrusel.
- `CarruselPeludos`: en el navegador, en cada visita, se barajan las tarjetas y sus puntos antes de iniciar el carrusel. Sin JS se ve el orden de compilación (`orden` del panel).
- `portada/Problematicas`: deja de mostrar el bloque de cifra (etiqueta, cifra, fecha y fuente). Las tarjetas quedan con ícono, título, texto y enlace.
- `src/lib/datos.ts`: se borra `cifraVisible`, que ya nadie usa.
- `CLAUDE.md`, `AGENTS.md` y `specs/README.md` al día. Esta spec es la 19 y anuncios pasa a la 20.

**Fuera de alcance (specs futuras):**

- Orden aleatorio en la galería de `/adopta`: conserva el `orden` del panel para que quien busca a un peludo lo encuentre en el mismo lugar.
- Orden aleatorio en `CarruselRefugio` (las fotos del refugio).
- Barajar al compilar.
- Borrar las columnas `etiqueta_cifra`, `cifra`, `fecha_cifra` y `fuente` de `problematicas`, o ponerlas en `null` en la nube o en `seed.sql`: se quedan como están y simplemente no se muestran.
- Volver a mostrar cifras con una fuente verificable (necesitaría su propia spec y la decisión de qué cuenta como verificable).
- Cambiar el texto o el enlace de las tarjetas. "Abandono y maltrato" conserva su caso de julio de 2025 y la nota de prensa, que sí se pueden verificar.
- Panel para editar `problematicas` o `refugio`: siguen en Studio.
- Anuncios (SPEC 20, RF-18).

## Modelo de datos

Esta spec no agrega ni cambia estructuras de datos, ni migraciones. Usa `refugio.enlace_mapa`, `refugio.latitud` y `refugio.longitud` (SPEC 12) a través de `enlaceMapaRefugio()` de `src/lib/mapas.ts`. Las columnas de cifra de `problematicas` y su esquema Zod siguen igual.

Enlace de la ubicación con mapa:

```html
<a href="https://www.google.com/maps/place/…" target="_blank" rel="noopener"
   data-umami-event="como_llegar" data-umami-event-origen="presentacion">
  <!-- ícono map-pin --> Tenancingo, Estado de México
  <span class="sr-only"> (abre Google Maps)</span>
</a>
```

Botón "Ver a todos los peludos": las mismas clases que "Quiero adoptar" de `Presentacion` (`inline-flex min-h-11 items-center gap-2 rounded-xl bg-acento px-5 font-bold text-sobre-acento`), con el ícono `arrow-right` y `tono="heredado"` después del texto, dentro de un contenedor `mt-4 flex justify-center`.

Barajado del carrusel:

- Función nueva `barajarCarrusel(raiz)` en `src/lib/carrusel.ts` (sin imports de Astro).
- Saca una permutación con Fisher-Yates y `Math.random()`.
- Reordena con esa misma permutación los `<li>` de `[data-pista]` y los `[data-punto]`, así cada punto sigue diciendo "Ver a {nombre}" del peludo que le toca.
- Después renumera `data-punto` de 0 en adelante y deja `aria-current="true"` solo en el primero.
- Al final regresa la pista a `scrollLeft = 0`: Chrome vuelve a ajustar el scroll-snap a la diapositiva que estaba primera y, sin esto, el carrusel arrancaba en ella (encontrado al implementar).
- El script de `CarruselPeludos` la llama sobre cada `[data-carrusel="peludos"]` justo antes de `iniciarCarrusel`. `CarruselRefugio` no la llama.

## Plan de implementación

1. **Ubicación a Google Maps.** En `portada/Presentacion`, calcular `enlaceMapaRefugio(refugio)`. Con enlace, el `<a>` va a él en otra pestaña con `rel="noopener"`, el evento `como_llegar` con `origen` `presentacion` y el texto oculto " (abre Google Maps)". Sin enlace, el `<a>` queda como hoy (`#quienes`). Actualizar el comentario del componente. Prueba manual: con `astro dev`, tocar "Tenancingo, Estado de México" abre la ficha del refugio en Google Maps en otra pestaña. Con `enlace_mapa`, `latitud` y `longitud` en `null` en local, baja a "Dónde estamos".
2. **Botón "Ver a todos los peludos".** En `portada/Adopciones`, cambiar el enlace por el botón descrito en el modelo de datos. Prueba manual: a 360 px y a 1280 px, el botón está centrado debajo de los puntos del carrusel, mide al menos 44 px de alto y lleva a `/adopta`.
3. **Carrusel aleatorio.** Agregar `barajarCarrusel` a `src/lib/carrusel.ts` y llamarla en el script de `CarruselPeludos` antes de `iniciarCarrusel`. Actualizar los comentarios de ambos archivos. Prueba manual: recargar la portada varias veces cambia el orden de las tarjetas. Tocar el tercer punto lleva al peludo cuyo nombre dice su `aria-label`. Las flechas y el avance automático siguen funcionando.
4. **Problemáticas sin cifras.** En `portada/Problematicas`, quitar el bloque de cifra y los imports de `cifraVisible` y `formatearMes`. Cambiar el comentario: la sección ya no muestra cifras porque no se pueden verificar. Borrar `cifraVisible` de `src/lib/datos.ts`. Prueba manual: `astro build` y `grep -c "Fuente:" dist/index.html` da `0`. Las 8 tarjetas siguen con título y texto, y "Abandono y maltrato" con su enlace.
5. **Documentación.** En `CLAUDE.md` y `AGENTS.md`:
   - `Presentacion`: la ubicación abre `enlaceMapaRefugio()` y, sin él, baja a `#quienes`.
   - `como_llegar` suma el `origen` `presentacion` en la lista de eventos de Umami.
   - `carrusel.ts` también tiene `barajarCarrusel`, que solo usa `CarruselPeludos` (orden aleatorio en cada visita).
   - `Problematicas` no muestra cifras.
   - `enlaceMapaRefugio` también se usa en `Presentacion`.
   - Estado: quitar las cifras de `problematicas` de lo pendiente.

   En `specs/README.md`, la fila 19 apunta a esta spec y anuncios pasa a la 20 (fila y "Pendiente de decidir"). En `CLAUDE.md` y `AGENTS.md`, "SPEC 19" de anuncios pasa a "SPEC 20".

## Criterios de aceptación

- [x] `astro build` y `npx astro check` terminan sin errores.
- [x] En la portada, "Tenancingo, Estado de México" tiene `href` igual a `refugio.enlace_mapa`, `target="_blank"`, `rel="noopener"`, `data-umami-event="como_llegar"` y `data-umami-event-origen="presentacion"`.
- [x] Un lector de pantalla anuncia que el enlace abre Google Maps.
- [x] Con `enlace_mapa`, `latitud` y `longitud` en `null` (local), el enlace apunta a `#quienes` y no lleva `target`.
- [x] Debajo del carrusel de `#adopta` hay un botón "Ver a todos los peludos" con fondo `bg-acento`, centrado y de al menos 44 px de alto, que lleva a `/adopta`.
- [x] Al recargar la portada 5 veces, el primer peludo del carrusel no es el mismo en todas (con 6 peludos de ejemplo en local).
- [x] Después de barajar, cada punto lleva al peludo que nombra su `aria-label`, y el primero tiene `aria-current="true"`.
- [x] Con JS desactivado, el carrusel muestra a los peludos en el orden del panel.
- [x] La galería de `/adopta` conserva el orden del panel en cada recarga.
- [x] El carrusel de fotos del refugio conserva su orden.
- [x] `dist/index.html` no contiene "Fuente:" ni "Dato de".
- [x] La sección "Lo que enfrenta un refugio todos los días" sigue mostrando sus 8 tarjetas con título y texto, y "Abandono y maltrato" con el enlace "Nota de prensa" y la etiqueta "Contenido sensible".
- [x] `grep -rn cifraVisible src` no da ningún resultado.
- [x] Ninguna migración nueva en `supabase/migrations/` y `seed.sql` sin cambios.

## Decisiones

- **Sí:** la ubicación usa `enlaceMapaRefugio()`, la misma función que "Cómo llegar". Así un cambio de `enlace_mapa` en Studio llega a los tres lugares.
- **Sí:** sin enlace ni coordenadas, la ubicación sigue bajando a `#quienes`. No se busca por nombre en Maps, igual que en la SPEC 12, para no mandar a nadie a un punto equivocado.
- **Sí:** evento `como_llegar` con `origen` `presentacion`. Mide cuánta gente abre el mapa desde ahí sin crear un evento nuevo.
- **Sí:** "Ver a todos" con el estilo de "Quiero adoptar". Es el estilo de llamado principal que ya existe.
- **No:** un botón de borde como "Dona". Es menos llamativo, que es justo lo que se quiere corregir.
- **No:** "Ver a los {n} peludos". El conteo depende de cada compilación y no aporta a que el botón se vea.
- **Sí:** barajar en el navegador en cada visita. Cada visitante ve un orden distinto, así ningún peludo queda siempre al principio.
- **No:** barajar al compilar. Todos verían el mismo orden hasta el siguiente deploy, y con un deploy diario seguiría habiendo un "primero del día".
- **Sí:** sin JS, el orden de compilación. El carrusel ya depende de JS para flechas, puntos y avance automático.
- **No:** barajar la galería de `/adopta`. Es donde se busca a un peludo concreto y conviene que no se mueva.
- **Sí:** quitar las cifras en código. No depende de editar datos en la nube y ninguna cifra no verificada puede volver a salir por error.
- **No:** poner las cifras en `null` en la nube. Dejaría el código listo para mostrar cualquier cifra que alguien vuelva a escribir en Studio.
- **No:** ocultar toda la sección. Los textos de las tarjetas explican la situación del refugio sin afirmar números.
- **No:** borrar las columnas de cifra. Es irreversible y no hace falta para dejar de mostrarlas.
- **Sí:** borrar `cifraVisible`. Sin el bloque de cifra no la usa nadie.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El carrusel se ve un instante en el orden de compilación antes de barajarse. | Está en la tercera sección de la portada, debajo del pliegue en el teléfono. El script corre al cargar la página, antes de que la persona llegue a él. |
| Barajar después de `iniciarCarrusel` dejaría los puntos ligados al peludo equivocado. | `barajarCarrusel` corre antes de `iniciarCarrusel` y reordena tarjetas y puntos con la misma permutación. Hay un criterio de aceptación para comprobarlo. |
| La ficha de Maps de `enlace_mapa` deja de existir. | Se cambia en Studio y llega a la ubicación, a "Cómo llegar" y al pie. |

## Lo que **no** entra en esta spec

- Orden aleatorio en `/adopta` o en el carrusel de fotos del refugio.
- Borrar o limpiar los datos de cifra de `problematicas`.
- Volver a mostrar cifras con fuente verificable.
- Cambiar los textos o enlaces de las tarjetas de problemáticas.
- Anuncios (SPEC 20).

Cada uno, si llega, va en su propia spec.
