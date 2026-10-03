// Loaders de content collections que leen Supabase al compilar (SPEC 06).
// Cada loader consulta su tabla con sus tablas hijas, arma la misma forma que tenían los JSON
// de la SPEC 01 y pasa cada registro por el esquema de src/content.config.ts.
import type { Loader } from "astro/loaders";
import { clienteSupabase, urlSupabase } from "./supabase";
import type { Imagen } from "./imagenes";

type Fila = Record<string, any>;
type FilaImagen = { ruta: string; ancho: number; alto: number };

const columnasImagen = "ruta, ancho, alto";

function imagen(fila: FilaImagen | null): Imagen | null {
  if (!fila) return null;
  return {
    url: `${urlSupabase()}/storage/v1/object/public/imagenes/${fila.ruta}`,
    ancho: fila.ancho,
    alto: fila.alto,
  };
}

/** Filas hijas por `orden`, sin la columna `orden`, que el esquema no conoce. */
function enOrden<T extends { orden: number }>(filas: T[]): Omit<T, "orden">[] {
  return [...filas]
    .sort((a, b) => a.orden - b.orden)
    .map(({ orden: _, ...resto }) => resto);
}

async function consultar(
  tabla: string,
  columnas: string,
  orden: string,
  filtro: Fila,
): Promise<Fila[]> {
  const { data, error } = await clienteSupabase()
    .from(tabla)
    .select(columnas)
    .match(filtro)
    .order(orden);
  if (error) {
    throw new Error(
      `No se pudo leer la tabla "${tabla}" de Supabase: ${error.message}`,
    );
  }
  return data as Fila[];
}

/**
 * Loader de una tabla: `mapear` convierte cada fila en los datos que valida el esquema y `filtro`
 * deja fuera las filas que no deben llegar al sitio (columna → valor exigido).
 */
function cargador(
  tabla: string,
  columnas = "*",
  mapear: (fila: Fila) => Fila = (fila) => fila,
  filtro: Fila = {},
): Loader {
  return {
    name: `supabase-${tabla}`,
    async load({ store, parseData }) {
      // Primero el cliente: si falta una variable, su error sale tal cual.
      clienteSupabase();
      let filas: Fila[];
      try {
        filas = await consultar(tabla, columnas, "id", filtro);
      } catch (error) {
        // supabase-js responde "fetch failed" sin decir a dónde; se agrega la URL.
        const mensaje = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${mensaje} (Supabase en ${urlSupabase()}; ¿corriste \`npx supabase start\`?)`,
        );
      }
      store.clear();
      for (const fila of filas) {
        const { id, ...resto } = mapear(fila);
        store.set({ id, data: await parseData({ id, data: resto }) });
      }
    },
  };
}

export const cargadorRedes = () => cargador("redes");
export const cargadorCategorias = () => cargador("categorias");
// Sin los borradores de necesidad que trajo Facebook (SPEC 16).
export const cargadorNecesidades = () =>
  cargador(
    "necesidades",
    "*",
    ({ por_revisar: _, publicacion_id: _p, ...resto }) => resto,
    { por_revisar: false },
  );
export const cargadorDestinosDonativo = () => cargador("destinos_donativo");
export const cargadorAnuncios = () => cargador("anuncios");

export const cargadorProblematicas = () =>
  cargador(
    "problematicas",
    "*",
    ({ enlace_texto, enlace_url, enlace_sensible, ...resto }) => ({
      ...resto,
      enlace:
        enlace_texto === null
          ? null
          : { texto: enlace_texto, url: enlace_url, sensible: enlace_sensible },
    }),
  );

export const cargadorRegistrosCifras = () =>
  cargador(
    "registros_cifras",
    "*, gastos_registro(concepto, monto, orden)",
    ({ gastos_registro, ...resto }) => ({
      ...resto,
      gastos: enOrden(gastos_registro),
    }),
  );

export const cargadorRefugio = () =>
  cargador(
    "refugio",
    `*, logo:imagenes!logo_id(${columnasImagen})`,
    ({ logo_id: _l, logo, ...resto }) => ({
      ...resto,
      logo: imagen(logo),
    }),
  );

export const cargadorBloquesContenido = () =>
  cargador(
    "bloques_contenido",
    `*, imagenes_bloque(orden, imagen:imagenes(${columnasImagen}))`,
    ({ imagenes_bloque, ...resto }) => ({
      ...resto,
      imagenes: enOrden(imagenes_bloque).map((fila: Fila) =>
        imagen(fila.imagen),
      ),
    }),
  );

export const cargadorPeludos = () =>
  cargador(
    "peludos",
    `*, fotos_peludo(orden, imagen:imagenes(${columnasImagen})), hitos_peludo(orden, fecha, tipo, texto, padrino)`,
    ({ fotos_peludo, hitos_peludo, por_revisar: _, ...resto }) => ({
      ...resto,
      fotos: enOrden(fotos_peludo).map((fila: Fila) => imagen(fila.imagen)),
      hitos: enOrden(hitos_peludo),
    }),
    // Los borradores de la sincronización con Facebook (SPEC 15) no salen hasta guardarlos en el panel.
    { por_revisar: false },
  );

export const cargadorCampanas = () =>
  cargador(
    "campanas",
    `*, cartel:imagenes(${columnasImagen})`,
    ({ cartel_id: _c, cartel, por_revisar: _r, ...resto }) => ({
      ...resto,
      cartel: imagen(cartel),
    }),
    { por_revisar: false },
  );

const dias = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;

/** Postgres entrega `time` como "13:00:00"; el esquema espera "13:00". */
const hora = (valor: string) => valor.slice(0, 5);

/** `{ lun: [{ abre, cierra }] | 'cerrado', … }` sin los días por confirmar, que no tienen fila. */
function horariosNegocio(filas: Fila[]): Fila {
  const horarios: Fila = {};
  for (const dia of dias) {
    const fila = filas.find((h) => h.dia === dia);
    if (!fila) continue;
    horarios[dia] = fila.cerrado
      ? "cerrado"
      : enOrden(fila.turnos).map((t: Fila) => ({
          abre: hora(t.abre),
          cierra: hora(t.cierra),
        }));
  }
  return horarios;
}

const columnasMenu =
  "grupos_menu(nombre, orden, secciones_menu(nombre, nota, orden, " +
  "platillos(nombre, descripcion, es_extra, disponible, orden, precios(etiqueta, monto, texto_alterno, orden))))";

export const cargadorNegocios = () =>
  cargador(
    "negocios",
    `*, logo:imagenes(${columnasImagen}), promociones(texto, fecha_inicio, fecha_fin), ` +
      `horarios(dia, cerrado, turnos(abre, cierra, orden)), ${columnasMenu}`,
    ({
      categoria_id,
      logo_id: _,
      logo,
      promociones,
      horarios,
      grupos_menu,
      ...resto
    }) => ({
      ...resto,
      categoria: categoria_id,
      logo: imagen(logo),
      horarios: horariosNegocio(horarios),
      promocion: promociones ?? null,
      // Grupos y secciones conservan `orden`, que usa menuDisponible(); platillos y precios van en su orden.
      menu: grupos_menu.map(({ secciones_menu, ...grupo }: Fila) => ({
        ...grupo,
        secciones: secciones_menu.map(({ platillos, ...seccion }: Fila) => ({
          ...seccion,
          platillos: enOrden(platillos).map((p: Fila) => ({
            ...p,
            precios: enOrden(p.precios),
          })),
        })),
      })),
    }),
  );
