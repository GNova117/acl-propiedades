import type { Objeto, TipoHabitacion } from "./types";

export type ObjetoDef = {
  id: string;
  nombre: string;
  categoria: TipoHabitacion;
  anchoM: number;
  largoM: number;
  /** Alto para el render 3D. */
  altoM: number;
  forma?: "rect" | "round";
};

export const ZONAS: { id: TipoHabitacion; nombre: string; color: string; fill: string }[] = [
  { id: "sala", nombre: "Sala", color: "#7c3aed", fill: "#f5f3ff" },
  { id: "cocina", nombre: "Cocina", color: "#ea580c", fill: "#fff7ed" },
  { id: "comedor", nombre: "Comedor", color: "#ca8a04", fill: "#fefce8" },
  { id: "recamara", nombre: "Recámara", color: "#2563eb", fill: "#eff6ff" },
  { id: "bano", nombre: "Baño", color: "#0891b2", fill: "#ecfeff" },
  { id: "lavanderia", nombre: "Lavandería", color: "#0d9488", fill: "#f0fdfa" },
  { id: "estudio", nombre: "Estudio", color: "#4f46e5", fill: "#eef2ff" },
  { id: "cochera", nombre: "Cochera", color: "#57534e", fill: "#f5f5f4" },
  { id: "exterior", nombre: "Exterior", color: "#16a34a", fill: "#f0fdf4" },
  { id: "otro", nombre: "Otro", color: "#52525b", fill: "#eef2ff" },
];

export function zonaDe(tipo: TipoHabitacion | undefined) {
  return ZONAS.find((z) => z.id === tipo) ?? ZONAS[ZONAS.length - 1];
}

export const OBJETOS_CATALOGO: ObjetoDef[] = [
  // Sala
  { id: "sofa3", nombre: "Sofá 3 plazas", categoria: "sala", anchoM: 2.0, largoM: 0.9, altoM: 0.85 },
  { id: "sofa2", nombre: "Sofá 2 plazas", categoria: "sala", anchoM: 1.5, largoM: 0.9, altoM: 0.85 },
  { id: "sillon", nombre: "Sillón", categoria: "sala", anchoM: 0.9, largoM: 0.9, altoM: 0.85 },
  { id: "mesa_centro", nombre: "Mesa de centro", categoria: "sala", anchoM: 1.1, largoM: 0.6, altoM: 0.4 },
  { id: "mueble_tv", nombre: "Mueble de TV", categoria: "sala", anchoM: 1.6, largoM: 0.45, altoM: 0.55 },
  { id: "librero", nombre: "Librero", categoria: "sala", anchoM: 1.0, largoM: 0.35, altoM: 1.8 },
  // Cocina
  { id: "estufa", nombre: "Estufa", categoria: "cocina", anchoM: 0.6, largoM: 0.6, altoM: 0.9 },
  { id: "refri", nombre: "Refrigerador", categoria: "cocina", anchoM: 0.7, largoM: 0.7, altoM: 1.75 },
  { id: "fregadero", nombre: "Fregadero", categoria: "cocina", anchoM: 0.9, largoM: 0.6, altoM: 0.9 },
  { id: "isla", nombre: "Isla", categoria: "cocina", anchoM: 1.8, largoM: 0.9, altoM: 0.9 },
  { id: "barra", nombre: "Barra / desayunador", categoria: "cocina", anchoM: 1.5, largoM: 0.5, altoM: 1.05 },
  { id: "meson", nombre: "Mesón / cubierta", categoria: "cocina", anchoM: 2.0, largoM: 0.6, altoM: 0.9 },
  { id: "lavavajillas", nombre: "Lavavajillas", categoria: "cocina", anchoM: 0.6, largoM: 0.6, altoM: 0.85 },
  // Comedor
  { id: "mesa4", nombre: "Mesa 4 personas", categoria: "comedor", anchoM: 1.2, largoM: 0.8, altoM: 0.75 },
  { id: "mesa6", nombre: "Mesa 6 personas", categoria: "comedor", anchoM: 1.8, largoM: 0.9, altoM: 0.75 },
  { id: "mesa_redonda", nombre: "Mesa redonda", categoria: "comedor", anchoM: 1.1, largoM: 1.1, altoM: 0.75, forma: "round" },
  { id: "silla", nombre: "Silla", categoria: "comedor", anchoM: 0.45, largoM: 0.45, altoM: 0.9 },
  { id: "trinchador", nombre: "Trinchador", categoria: "comedor", anchoM: 1.5, largoM: 0.45, altoM: 0.9 },
  // Recámara
  { id: "cama_matrimonial", nombre: "Cama matrimonial", categoria: "recamara", anchoM: 1.6, largoM: 2.0, altoM: 0.5 },
  { id: "cama_king", nombre: "Cama king", categoria: "recamara", anchoM: 1.95, largoM: 2.05, altoM: 0.5 },
  { id: "cama_individual", nombre: "Cama individual", categoria: "recamara", anchoM: 1.0, largoM: 1.9, altoM: 0.5 },
  { id: "buro", nombre: "Buró", categoria: "recamara", anchoM: 0.45, largoM: 0.4, altoM: 0.5 },
  { id: "closet", nombre: "Clóset", categoria: "recamara", anchoM: 1.8, largoM: 0.6, altoM: 2.1 },
  { id: "comoda", nombre: "Cómoda", categoria: "recamara", anchoM: 1.2, largoM: 0.5, altoM: 0.85 },
  { id: "tocador", nombre: "Tocador", categoria: "recamara", anchoM: 1.0, largoM: 0.45, altoM: 0.75 },
  // Baño
  { id: "wc", nombre: "Inodoro", categoria: "bano", anchoM: 0.4, largoM: 0.7, altoM: 0.4 },
  { id: "lavabo", nombre: "Lavabo", categoria: "bano", anchoM: 0.6, largoM: 0.45, altoM: 0.85 },
  { id: "regadera", nombre: "Regadera", categoria: "bano", anchoM: 0.9, largoM: 0.9, altoM: 0.1 },
  { id: "tina", nombre: "Tina", categoria: "bano", anchoM: 1.7, largoM: 0.75, altoM: 0.55 },
  { id: "mueble_bano", nombre: "Gabinete", categoria: "bano", anchoM: 0.8, largoM: 0.35, altoM: 1.6 },
  // Lavandería
  { id: "lavadora", nombre: "Lavadora", categoria: "lavanderia", anchoM: 0.6, largoM: 0.65, altoM: 0.95 },
  { id: "secadora", nombre: "Secadora", categoria: "lavanderia", anchoM: 0.6, largoM: 0.65, altoM: 0.95 },
  { id: "lavadero", nombre: "Lavadero", categoria: "lavanderia", anchoM: 0.8, largoM: 0.6, altoM: 0.9 },
  { id: "boiler", nombre: "Boiler", categoria: "lavanderia", anchoM: 0.5, largoM: 0.5, altoM: 1.4, forma: "round" },
  // Estudio
  { id: "escritorio", nombre: "Escritorio", categoria: "estudio", anchoM: 1.4, largoM: 0.7, altoM: 0.75 },
  { id: "silla_oficina", nombre: "Silla de oficina", categoria: "estudio", anchoM: 0.6, largoM: 0.6, altoM: 0.95, forma: "round" },
  { id: "estante", nombre: "Estante", categoria: "estudio", anchoM: 1.2, largoM: 0.35, altoM: 1.9 },
  // Cochera
  { id: "auto", nombre: "Auto", categoria: "cochera", anchoM: 1.9, largoM: 4.5, altoM: 1.5 },
  { id: "moto", nombre: "Moto", categoria: "cochera", anchoM: 0.8, largoM: 2.0, altoM: 1.1 },
  { id: "bodega", nombre: "Estante de bodega", categoria: "cochera", anchoM: 1.5, largoM: 0.5, altoM: 1.8 },
  // Exterior
  { id: "alberca", nombre: "Alberca", categoria: "exterior", anchoM: 3.0, largoM: 6.0, altoM: 0.05 },
  { id: "asador", nombre: "Asador", categoria: "exterior", anchoM: 0.7, largoM: 0.5, altoM: 0.9 },
  { id: "mesa_jardin", nombre: "Mesa de jardín", categoria: "exterior", anchoM: 1.2, largoM: 1.2, altoM: 0.75, forma: "round" },
  { id: "arbol", nombre: "Árbol / planta", categoria: "exterior", anchoM: 1.2, largoM: 1.2, altoM: 2.2, forma: "round" },
  { id: "jardinera", nombre: "Jardinera", categoria: "exterior", anchoM: 1.5, largoM: 0.5, altoM: 0.5 },
];

export function objetoDef(id: string): ObjetoDef | undefined {
  return OBJETOS_CATALOGO.find((o) => o.id === id);
}

/** Paquetes de una zona: se colocan juntos con un solo clic. */
export type Kit = { id: string; nombre: string; categoria: TipoHabitacion; items: string[] };

export const KITS: Kit[] = [
  { id: "kit_cocina", nombre: "Cocina completa", categoria: "cocina", items: ["refri", "estufa", "fregadero", "meson", "isla"] },
  { id: "kit_sala", nombre: "Sala básica", categoria: "sala", items: ["sofa3", "sofa2", "mesa_centro", "mueble_tv"] },
  { id: "kit_comedor", nombre: "Comedor de 4", categoria: "comedor", items: ["mesa4", "silla", "silla", "silla", "silla"] },
  { id: "kit_recamara", nombre: "Recámara principal", categoria: "recamara", items: ["cama_matrimonial", "buro", "buro", "closet", "comoda"] },
  { id: "kit_bano", nombre: "Baño completo", categoria: "bano", items: ["wc", "lavabo", "regadera"] },
  { id: "kit_lavanderia", nombre: "Lavandería", categoria: "lavanderia", items: ["lavadora", "secadora", "lavadero", "boiler"] },
  { id: "kit_estudio", nombre: "Estudio", categoria: "estudio", items: ["escritorio", "silla_oficina", "estante"] },
];

export function nuevoObjeto(defId: string, x: number, z: number, habitacionId: string | null): Objeto | null {
  const def = objetoDef(defId);
  if (!def) return null;
  return { id: crypto.randomUUID(), tipo: def.id, habitacionId, x, z, anchoM: def.anchoM, largoM: def.largoM, rotDeg: 0 };
}

/**
 * Coloca un kit acomodado en filas dentro de la caja (minX..maxX, desde minZ), de izquierda a
 * derecha con salto de fila. Es un punto de partida: cada pieza se arrastra a su lugar después.
 */
export function colocarKit(kit: Kit, area: { minX: number; maxX: number; minZ: number }, habitacionId: string | null): Objeto[] {
  const GAP = 0.1;
  const out: Objeto[] = [];
  let cursorX = area.minX + GAP;
  let cursorZ = area.minZ + GAP;
  let rowH = 0;
  for (const defId of kit.items) {
    const def = objetoDef(defId);
    if (!def) continue;
    if (cursorX + def.anchoM > area.maxX && cursorX > area.minX + GAP) {
      cursorX = area.minX + GAP;
      cursorZ += rowH + GAP;
      rowH = 0;
    }
    out.push({
      id: crypto.randomUUID(),
      tipo: def.id,
      habitacionId,
      x: cursorX + def.anchoM / 2,
      z: cursorZ + def.largoM / 2,
      anchoM: def.anchoM,
      largoM: def.largoM,
      rotDeg: 0,
    });
    cursorX += def.anchoM + GAP;
    rowH = Math.max(rowH, def.largoM);
  }
  return out;
}
