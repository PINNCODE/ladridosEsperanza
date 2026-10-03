// Imagen genérica de cada tipo de necesidad (SPEC 16) para "Necesidades del mes". Es la misma para las
// necesidades capturadas a mano y las que trae Facebook. Cada tipo usa `src/assets/necesidades/{tipo}.jpg`
// si existe; si no, su ícono de Lucide (alimento usa antes la foto de los gatos comiendo). Cambiar una
// imagen es un commit, no una edición del panel.
import type { ImageMetadata } from "astro";
import gatosComiendo from "../assets/refugio/gatos-comiendo.jpg";

export type TipoNecesidad =
  "alimento" | "medicina" | "cobijas" | "limpieza" | "otro";

// `import.meta.glob` en lugar de imports: un archivo que falta no rompe el build.
const archivos = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/necesidades/*.jpg",
  { eager: true },
);

const iconos: Record<TipoNecesidad, string> = {
  alimento: "bone",
  medicina: "pill",
  cobijas: "bed",
  limpieza: "spray-can",
  otro: "package",
};

const respaldos: Partial<Record<TipoNecesidad, ImageMetadata>> = {
  alimento: gatosComiendo,
};

export function imagenNecesidad(tipo: TipoNecesidad): {
  imagen?: ImageMetadata;
  icono: string;
} {
  return {
    imagen:
      archivos[`../assets/necesidades/${tipo}.jpg`]?.default ?? respaldos[tipo],
    icono: iconos[tipo],
  };
}
