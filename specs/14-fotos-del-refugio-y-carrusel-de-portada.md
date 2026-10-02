# SPEC 14 — Fotos del refugio: carrusel en la portada y fotos en las páginas

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 11, SPEC 12, SPEC 13
> **Fecha:** 2026-10-02
> **Objetivo:** Cambiar la foto única de la presentación de la portada por un carrusel con 9 fotos reales del refugio, horizontales y verticales, que se ven completas en un marco cuadrado, y usar esas mismas fotos en esterilización, donativos en especie, los encabezados de `/adopta`, `/donar` y `/esterilizacion` y la imagen para compartir.

## Por qué existe esta spec

Hoy el sitio tiene una sola foto del refugio (`refugio/patio.jpg`, 387 × 516 px), que sale borrosa en pantallas de alta densidad.
El refugio entregó 9 fotos reales (en `imagenes-refugio/`, ignorada por git): 4 horizontales, desde casi cuadrada hasta panorámica (3051 × 1373), y 5 verticales de 1536 × 2048.
Mezclar proporciones tan distintas en un carrusel obliga a decidir cómo se ven sin recortar caras ni hacer saltar la página.

Estas fotos son reales, no de ejemplo: se ven con y sin `PUBLIC_MOSTRAR_EJEMPLOS`.

Esta spec toma el número 14; los anuncios (RF-18) pasan a la 15.

## Alcance

**Dentro:**

- Las 9 fotos copiadas a `src/assets/refugio/` con nombres descriptivos y optimizadas por Astro (`<Image>` y `getImage`).
- Catálogo único `src/lib/fotosRefugio.ts`: cada foto con su texto alternativo y su punto de enfoque, el orden del carrusel y la imagen para compartir.
- Carrusel `CarruselRefugio` en la columna derecha de `Presentacion`, en lugar de la foto actual: marco cuadrado, foto completa sobre un fondo difuminado de la misma foto, flechas, puntos, teclado, deslizar con el dedo y avance automático cada 5 s.
- Script del carrusel sacado de `CarruselPeludos` a `src/lib/carrusel.ts` y usado por los dos carruseles.
- Foto de la gata con su camada en la sección "Esterilizar salva vidas" de la portada.
- Foto del cuarto de gatos comiendo en la tarjeta "Dona en especie" de la portada y "Donar en especie" de `/donar`.
- Prop opcional `foto` en `EncabezadoPagina`, usada en `/adopta`, `/donar` y `/esterilizacion`.
- Imagen para compartir (`og:image`, que X también usa a falta de `twitter:image`) y `image` del JSON-LD `AnimalShelter` generadas desde la foto de los perros en la barda, en 1200 × 630.
- Migración que borra `refugio.foto_principal_id`, con `limpiar_imagenes` al día; la semilla, el esquema y el cargador dejan de usarla.

**Fuera de alcance (specs futuras):**

- Subir, ordenar o cambiar las fotos del refugio desde el panel `/admin` o desde Supabase; se cambian con un commit.
- Fotos en Problemáticas, Quiénes somos, Colaboración, `/colabora` o la página 404.
- Visor de fotos a pantalla completa.
- Fotos de los peludos: siguen en Supabase y en el panel (SPEC 08 y 13).
- Logo del refugio en alta resolución; sigue pendiente en "Antes de publicar".
- Pies de foto o créditos visibles.
- Anuncios (SPEC 15, RF-18).

## Modelo de datos

### Fotos (`src/assets/refugio/`)

| Archivo | Original en `imagenes-refugio/` | Tamaño | Texto alternativo |
| --- | --- | --- | --- |
| `perros-en-la-barda.jpg` | `110250892_…_n.jpg` | 2048 × 1536 | Tres perros del refugio asomados a la barda, con más perros en el patio detrás |
| `gata-en-su-casita.jpg` | `634408427_…_n.jpg` | 1536 × 2048 | Gata atigrada de ojos verdes asomada en su casita de madera |
| `perros-en-el-patio.jpg` | `470212762_…_n.jpg` | 2048 × 1150 | Grupo de perros del refugio mirando a la cámara en el patio |
| `gatitos-en-la-caja.jpg` | `633395387_…_n.jpg` | 938 × 812 | Tres gatitos atigrados juntos sobre una caja rascadora |
| `perro-negro-en-la-mano.jpg` | `617613048_…_n.jpg` | 1536 × 2048 | Perro negro recargando el hocico en la mano de una persona |
| `gata-con-su-camada.jpg` | `722769706_…_n.jpeg` | 1536 × 2048 | Gata siamés sentada en una tina junto a su camada de diez gatitos recién nacidos |
| `perros-rodeando-la-camara.jpg` | `474063020_…_n.jpg` | 3051 × 1373 | Decenas de perros del refugio rodeando a quien toma la foto en el patio |
| `gatito-negro.jpg` | `728618776_…_n.jpeg` | 1536 × 2048 | Gatito negro cargado con una mano |
| `gatos-comiendo.jpg` | `658907020_…_n.jpg` | 1536 × 2048 | Gatos del refugio comiendo de sus platos en el cuarto de los gatos |

Los textos alternativos no repiten "foto de".
Los originales se copian tal cual; Astro genera los tamaños y quita los metadatos al optimizar.

### Catálogo (`src/lib/fotosRefugio.ts`)

```ts
import type { ImageMetadata } from 'astro';

export interface FotoRefugio {
	src: ImageMetadata;
	alt: string;
	/** `object-position` cuando la foto se recorta: "50% 40%". */
	enfoque: string;
}

export const fotosRefugio: Record<'perrosEnLaBarda' | 'gataEnSuCasita' | /* … las 9 … */ 'gatosComiendo', FotoRefugio>;

/** Orden del carrusel de la portada: alterna perros y gatos, abre con la barda. */
export const fotosPortada: FotoRefugio[];

/** Imagen para compartir: la barda en 1200 × 630, JPEG, con URL absoluta. */
export function imagenCompartir(sitio: URL): Promise<{ url: string; ancho: 1200; alto: 630; alt: string }>;
```

Orden de `fotosPortada`: perros en la barda, gata en su casita, perros en el patio, gatitos en la caja, perro negro en la mano, gata con su camada, perros rodeando la cámara, gatito negro, gatos comiendo.

### Dónde va cada foto

| Lugar | Foto | Marco |
| --- | --- | --- |
| Carrusel de `Presentacion` | Las 9, en el orden de arriba | 1:1, foto completa sobre fondo difuminado |
| Sección "Esterilizar salva vidas" (`portada/Esterilizacion`) | Gata con su camada | 1:1, recorte con enfoque `50% 15%` |
| Tarjeta "Dona en especie" (`portada/Donativos`) | Gatos comiendo | 4:3, recorte con enfoque `50% 65%` |
| Tarjeta "Donar en especie" (`donar/FormasDeAyudar`) | Gatos comiendo | 4:3, recorte con enfoque `50% 65%` |
| Encabezado de `/adopta` | Perros en el patio | 4:3, recorte con enfoque `50% 50%` |
| Encabezado de `/donar` | Perro negro en la mano | 4:3, recorte con enfoque `50% 55%` |
| Encabezado de `/esterilizacion` | Gata con su camada | 4:3, recorte con enfoque `50% 15%` |
| `og:image`, `twitter:image` y JSON-LD | Perros en la barda | 1200 × 630, recorte al centro |

Cada foto tiene un solo enfoque en `fotosRefugio.ts`, el mismo en todos sus marcos. La camada quedó en `50% 15%` al ver las capturas: con `40%` el encabezado 4:3 le cortaba las orejas a la gata, y con `15%` el marco cuadrado la sigue mostrando completa.

### Carrusel del refugio (`src/components/portada/CarruselRefugio.astro`)

- Marco `aspect-square`, `rounded-2xl`, con borde `border-lineas`, del ancho de la columna (todo el ancho en teléfono).
- Cada diapositiva tiene dos `<Image>` de la misma foto:
  - Fondo: 48 px de ancho, `object-cover`, difuminado con `blur-2xl` y escalado a 150 % (con 110 % se aclaraba el borde izquierdo), `alt=""` y `aria-hidden="true"`.
  - Frente: `object-contain` dentro del marco, `width={1280}` y `widths` de 400 a 1280 (sin `width`, el `src` de respaldo salía al tamaño original) y `sizes="(min-width: 768px) 50vw, 100vw"`.
- La primera diapositiva lleva `loading="eager"` y `fetchpriority="high"`; las demás, `loading="lazy"`.
- `role="region"`, `aria-roledescription="carrusel"`, `aria-label="Fotos del refugio"`; cada diapositiva `role="group"`, `aria-roledescription="diapositiva"` y `aria-label="1 de 9"`.
- Debajo: flecha "Anterior", 9 puntos ("Ver foto 3") y flecha "Siguiente". Los puntos miden 24 px de ancho y 44 de alto para que las 9 quepan en una línea a 360 px.
- Sin JS se desliza con el dedo gracias a `scroll-snap`, como el carrusel de peludos.

### Script compartido (`src/lib/carrusel.ts`, sin imports de Astro)

`iniciarCarrusel(raiz: HTMLElement)`: el comportamiento actual de `CarruselPeludos` sin cambios.

- Flechas, puntos y teclado (← →), con `aria-current` en el punto activo.
- Avance automático cada 5 s: no arranca con "reducir movimiento", no avanza con la pestaña oculta ni con el carrusel fuera de pantalla, y se apaga para toda la visita al primer toque, rueda, tecla o foco dentro del carrusel.
- Al llegar a la última foto vuelve a la primera.

Cada carrusel se marca con su propio valor: `data-carrusel="peludos"` y `data-carrusel="refugio"`.
Cada componente llama a `iniciarCarrusel` solo sobre los suyos, para que ningún carrusel se inicie dos veces.

### `EncabezadoPagina`

Prop nueva opcional `foto?: FotoRefugio`.

- Sin `foto`: queda igual que hoy.
- Con `foto`: desde `md`, dos columnas (ícono, título y frase a la izquierda; foto a la derecha). En teléfono, la foto va debajo de la frase.
- La foto lleva `loading="eager"` porque está arriba de la página.

### Migración `quitar_foto_principal`

```sql
-- Las fotos del refugio viven en el repo (SPEC 14); la imagen para compartir sale de ahí.
create or replace function public.limpiar_imagenes(ids uuid[]) returns text[]
-- … igual que en panel_refugio, pero la condición de refugio solo revisa r.logo_id …

alter table refugio drop column foto_principal_id;
```

- La fila de `imagenes` que apuntaba la columna no se borra: en la semilla, `refugio/patio.jpg` sigue siendo la segunda foto de Luna.
- Sin RPC ni políticas nuevas.
- `alter table` no dispara el trigger `recompilar`.

### Esquema, cargador y semilla

- `src/content.config.ts`: `refugio` ya no tiene `foto_principal`.
- `src/lib/cargadores.ts`: el `select` de `refugio` solo une `logo`; `foto_principal_id` sale de la desestructuración.
- `supabase/seed.sql`: el `insert into refugio` ya no lleva `foto_principal_id`.

### Compartir y JSON-LD

- `Layout`: sin prop `imagen`, `compartir` usa `imagenCompartir(Astro.site)` con tarjeta `summary_large_image` y el alt "Perros del refugio {nombre} asomados a la barda".
- `og:image` es una URL absoluta (`new URL(src, sitio)`), porque la imagen ya no viene de Supabase. `Layout` no tiene `twitter:image`; X usa `og:image`.
- `datosRefugio(refugio, redes, sitio, imagen)` recibe la URL de `imagenCompartir` para `image`.

## Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `src/assets/refugio/*.jpg` | Nuevos: las 9 fotos con los nombres de la tabla |
| `src/lib/fotosRefugio.ts` | Nuevo: catálogo, `fotosPortada` e `imagenCompartir` |
| `src/lib/carrusel.ts` | Nuevo: `iniciarCarrusel`, sacado de `CarruselPeludos` |
| `src/components/CarruselPeludos.astro` | `data-carrusel="peludos"` y su script llama a `iniciarCarrusel` |
| `src/components/portada/CarruselRefugio.astro` | Nuevo |
| `src/components/portada/Presentacion.astro` | Usa `CarruselRefugio` en lugar de la foto |
| `src/components/portada/Esterilizacion.astro` | Foto de la camada |
| `src/components/portada/Donativos.astro` | Foto de los gatos comiendo en "Dona en especie" |
| `src/components/donar/FormasDeAyudar.astro` | Foto de los gatos comiendo en "Donar en especie" |
| `src/components/EncabezadoPagina.astro` | Prop `foto` |
| `src/pages/adopta.astro`, `donar.astro`, `esterilizacion.astro` | Pasan su `foto` |
| `src/layouts/Layout.astro` | `compartir` con `imagenCompartir` |
| `src/lib/seo.ts` | `datosRefugio` recibe la imagen |
| `src/pages/index.astro` | Pasa la imagen a `datosRefugio` |
| `src/content.config.ts`, `src/lib/cargadores.ts` | Sin `foto_principal` |
| `supabase/migrations/<fecha>_quitar_foto_principal.sql` | Nueva |
| `supabase/seed.sql` | Sin `foto_principal_id` |
| `specs/README.md`, `CLAUDE.md`, `AGENTS.md` | Índice (14 esta, anuncios a la 15), "Antes de publicar" sin la foto del patio, `fotosRefugio.ts`, `carrusel.ts`, `CarruselRefugio` y la imagen para compartir |

## Plan de implementación

1. Copiar las 9 fotos a `src/assets/refugio/` con sus nombres y crear `src/lib/fotosRefugio.ts` con el catálogo y `fotosPortada`. `astro build` compila igual que antes.
2. Sacar el script de `CarruselPeludos` a `src/lib/carrusel.ts` y marcar `data-carrusel="peludos"`. El carrusel de peludos de la portada se comporta igual.
3. `CarruselRefugio` y `Presentacion` con el carrusel. Revisar a 360, 768 y 1280 px una foto vertical, una horizontal y la panorámica.
4. Fotos en `portada/Esterilizacion`, `portada/Donativos` y `donar/FormasDeAyudar`.
5. Prop `foto` en `EncabezadoPagina` y las tres páginas. Ajustar los enfoques con capturas.
6. `imagenCompartir`, `Layout` y `datosRefugio` con la imagen del repo; la portada, `/adopta` y `/donar` ya no leen `foto_principal`.
7. Quitar `foto_principal` de `content.config.ts`, `cargadores.ts` y `seed.sql`, y escribir la migración `quitar_foto_principal`. Comprobar con `npx supabase db reset`, `astro build` y `npx astro check`.
8. `specs/README.md`, `CLAUDE.md` y `AGENTS.md`.
9. Paso manual en la nube **después del merge**: `npx supabase db push`. El código nuevo ya no lee la columna, así que `main` compila con ella o sin ella; al revés, el código de `main` anterior fallaría sin la columna.

## Criterios de aceptación

### Carrusel de la portada

- [x] La portada muestra un carrusel con 9 fotos en la columna derecha desde 768 px y debajo del texto en teléfono.
- [x] El marco es cuadrado y mide lo mismo en las 9 diapositivas.
- [x] La gata con su camada (vertical) y los perros rodeando la cámara (panorámica) se ven completas, sin recorte, con el fondo difuminado de la misma foto.
- [x] Ninguna diapositiva cambia la altura de la página al pasar de una a otra.
- [x] Las flechas, los puntos, las teclas ← → y deslizar con el dedo cambian de foto, y el punto activo tiene `aria-current="true"`.
- [x] Los 9 puntos y las dos flechas caben en una línea a 360 px, sin desplazamiento horizontal de la página.
- [x] El carrusel avanza solo cada 5 s y, después de la novena foto, vuelve a la primera.
- [x] Tocar, enfocar o usar la rueda sobre el carrusel apaga el avance automático; con "reducir movimiento" nunca arranca.
- [x] Solo la primera foto se descarga con la página; las demás llevan `loading="lazy"`.
- [x] Las imágenes de fondo tienen `alt=""` y `aria-hidden="true"`; las del frente, el texto alternativo de la tabla.
- [x] Con JS desactivado, el carrusel se desliza con el dedo y muestra las 9 fotos.
- [x] El carrusel de peludos de la portada sigue con flechas, puntos y avance automático, y ninguno de los dos carruseles se inicia dos veces.

### Fotos en las demás secciones

- [x] "Esterilizar salva vidas" de la portada muestra la gata con su camada en un marco cuadrado, sin cortar la cabeza de la gata.
- [x] "Dona en especie" de la portada y "Donar en especie" de `/donar` muestran los gatos comiendo en 4:3.
- [x] `/adopta`, `/donar` y `/esterilizacion` muestran su foto junto al título desde 768 px y debajo de la frase en teléfono.
- [x] Una página que usa `EncabezadoPagina` sin `foto` se ve igual que antes.
- [x] Todas las fotos se sirven en AVIF o WebP desde `/_astro/` y ninguna mide más de 1280 px de ancho.
- [x] Las fotos se ven con `PUBLIC_MOSTRAR_EJEMPLOS` apagada, siempre que exista un registro real de `refugio`.

### Compartir y datos

- [x] El HTML de la portada tiene `og:image` con una URL absoluta de `/_astro/` de 1200 × 630, `og:image:width` 1200 y `og:image:height` 630.
- [x] El JSON-LD `AnimalShelter` de la portada tiene `image` con la misma URL.
- [x] `/colabora/{slug}` sigue compartiendo el logo del negocio.
- [x] Después de `npx supabase db reset`, `refugio` ya no tiene la columna `foto_principal_id` y Luna sigue con 2 fotos.
- [x] `limpiar_imagenes` sigue sin borrar el logo del refugio.
- [x] `grep -rn foto_principal src supabase/seed.sql` no encuentra nada.
- [x] `npx astro check` no reporta errores y `astro build` termina.

## Decisiones

- **Sí:** fotos en el repo (`src/assets/refugio/`). Astro las convierte a AVIF/WebP en varios tamaños, no hace falta migración para cargarlas y son fotos fijas del refugio, no contenido que cambie cada semana.
- **No:** tabla `fotos_portada` con pantalla en el panel. El refugio podría cambiarlas solo, pero suma migración, RPC, pantalla y subir las fotos a la nube; puede ir en otra spec.
- **No:** tabla en Supabase editada en Studio. Saca los datos del código sin hacerlos fáciles de editar para el refugio.
- **Sí:** marco fijo con la foto completa sobre su versión difuminada. Ninguna foto se recorta, ninguna cara se corta y la página no salta de altura.
- **No:** marco fijo con recorte en el carrusel. La panorámica y las verticales perderían mucho.
- **No:** misma altura y ancho variable. En teléfono la panorámica quedaría diminuta.
- **Sí:** marco cuadrado. Las verticales ocupan 3/4 del ancho y las horizontales 3/4 del alto; es el punto medio para 4 horizontales y 5 verticales.
- **Sí:** fondo difuminado con una versión de 48 px de la misma foto. Pesa casi nada y el `blur` de CSS no se anima.
- **Sí:** carrusel en la columna derecha de la presentación. El nombre y los botones siguen siendo lo primero que se lee.
- **No:** carrusel a todo lo ancho o texto encima de las fotos. Bajan los botones o dejan el contraste a merced de cada foto.
- **Sí:** las 9 fotos en el carrusel, aunque algunas también salgan en otra sección. Ninguna foto se queda sin usar y el carrusel mezcla perros y gatos.
- **Sí:** avance automático igual al del carrusel de peludos. Un solo comportamiento en el sitio, y se apaga en cuanto la persona toca el carrusel.
- **Sí:** script compartido en `src/lib/carrusel.ts`. Dos copias del mismo script se desincronizarían, y el selector `[data-carrusel]` de hoy iniciaría también el carrusel nuevo.
- **Sí:** puntos de 24 px de ancho. Las 9 caben en una línea a 360 px; siguen midiendo 44 px de alto para tocarlos.
- **Sí:** recorte con punto de enfoque fuera del carrusel. En tarjetas y encabezados una foto entera con fondo difuminado se vería como un hueco.
- **Sí:** la gata con su camada en esterilización. Diez gatitos de una sola camada explican el porqué sin texto.
- **Sí:** los gatos comiendo en "Dona en especie". Muestra a dónde va el alimento donado.
- **Sí:** perros en el patio para `/adopta`, perro negro en la mano para `/donar` y la camada para `/esterilizacion`. Cada foto dice lo que pide su página.
- **Sí:** imagen para compartir de 1200 × 630 desde la barda. Es el tamaño que esperan WhatsApp y Facebook, y la foto es la más clara con caras de frente.
- **Sí:** borrar `refugio.foto_principal_id`. Un solo origen para las fotos del refugio; una columna sin uso confunde.
- **No:** dejar la columna sin uso. Menos trabajo hoy, pero un dato muerto que alguien editaría en Studio sin efecto.
- **Sí:** `db push` después del merge. El código nuevo funciona con la columna o sin ella; el de antes, no.
- **Sí:** número 14 para esta spec y anuncios a la 15. Las specs se numeran en el orden en que se escriben.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración se aplica antes del merge y `main` deja de compilar | El plan pide `db push` después del merge. Si pasa, Vercel conserva el último despliegue bueno y basta con hacer el merge. |
| 9 fotos hacen pesada la portada en teléfono | Solo la primera carga con la página; las demás son `lazy`, en AVIF/WebP y con `sizes`. |
| La foto del carrusel empeora el LCP | La primera diapositiva lleva `fetchpriority="high"` y no tiene animación de entrada. |
| Un recorte corta una cara | Enfoque por foto en `fotosRefugio.ts`, revisado con capturas en el paso 5. |
| Las fotos tienen personas reconocibles | Solo se ven manos y un brazo; ninguna cara de persona. Si llega una foto con caras, se pide permiso antes de agregarla. |
| Facebook o WhatsApp guardan la vista previa vieja | Pasar la portada por el depurador de Facebook después de publicar. |
| El refugio quiere cambiar una foto | Se cambia el archivo en `src/assets/refugio/` y su entrada en `fotosRefugio.ts` con un commit; el panel queda para otra spec. |

## Lo que **no** entra en esta spec

- Editar las fotos del refugio desde el panel o desde Supabase.
- Fotos en Problemáticas, Quiénes somos, Colaboración, `/colabora` o la 404.
- Visor de fotos a pantalla completa.
- Cambios a las fotos de los peludos.
- Logo en alta resolución.
- Pies de foto o créditos.
- Anuncios (SPEC 15, RF-18).
