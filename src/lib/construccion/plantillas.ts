// Plantillas de distribución: reparten una zona rectangular en varias zonas con nombre y uso ya puestos
// (oficina con privados, casa de N recámaras…). Los lados que se comparten salen con las mismas
// coordenadas, así las divisorias después se pueden arrastrar como cualquier otra.
import { pointInPolygon, type Point } from "./geometry";
import { repartirAberturas } from "./dividir";
import { esRectangulo } from "./divisores";
import type { Habitacion, Proyecto, TipoHabitacion } from "./types";

const PASO_M = 0.05;
const LADO_MINIMO_M = 0.5;

type Zona = { nombre: string; tipo: TipoHabitacion };
type Parte = { peso: number; zona?: Zona; nodo?: Nodo };
/** "fila" apila franjas de arriba hacia abajo; "columna" las pone una junto a otra de izquierda a derecha. */
type Nodo = { dir: "fila" | "columna"; partes: Parte[] };

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Cantidad ajustable (privados, recámaras, partes…). */
  param?: { etiqueta: string; min: number; max: number; def: number };
  construir: (n: number) => Nodo;
};

const z = (nombre: string, tipo: TipoHabitacion, peso = 1): Parte => ({ peso, zona: { nombre, tipo } });
const repetir = (n: number, hacer: (i: number) => Parte): Parte[] => Array.from({ length: n }, (_, i) => hacer(i));

export const PLANTILLAS: Plantilla[] = [
  {
    id: "oficina_privados",
    nombre: "Oficina: privados + juntas + recepción",
    descripcion: "Una fila de privados al frente, un pasillo, y al fondo la recepción y la sala de juntas.",
    param: { etiqueta: "Privados", min: 1, max: 8, def: 4 },
    construir: (n) => ({
      dir: "fila",
      partes: [
        { peso: 0.38, nodo: { dir: "columna", partes: repetir(n, () => z("Oficina", "oficina")) } },
        z("Pasillo", "pasillo", 0.1),
        { peso: 0.52, nodo: { dir: "columna", partes: [z("Recepción", "recepcion", 0.4), z("Sala de juntas", "sala_juntas", 0.6)] } },
      ],
    }),
  },
  {
    id: "oficina_abierta",
    nombre: "Oficina abierta + servicios",
    descripcion: "Un área abierta de trabajo y, al fondo, sala de juntas, baño, cocineta y bodega.",
    construir: () => ({
      dir: "fila",
      partes: [
        z("Área abierta", "oficina", 0.6),
        { peso: 0.4, nodo: { dir: "columna", partes: [z("Sala de juntas", "sala_juntas", 0.35), z("Baño", "bano", 0.2), z("Cocineta", "cocina", 0.25), z("Bodega", "bodega", 0.2)] } },
      ],
    }),
  },
  {
    id: "casa_recamaras",
    nombre: "Casa: recámaras + zona social",
    descripcion: "Recámaras y baño en una franja; sala, comedor, cocina y lavandería en la otra.",
    param: { etiqueta: "Recámaras", min: 1, max: 5, def: 3 },
    construir: (n) => ({
      dir: "fila",
      partes: [
        { peso: 0.45, nodo: { dir: "columna", partes: [...repetir(n, () => z("Recámara", "recamara")), z("Baño", "bano", 0.6)] } },
        { peso: 0.55, nodo: { dir: "columna", partes: [z("Sala", "sala", 0.35), z("Comedor", "comedor", 0.25), z("Cocina", "cocina", 0.25), z("Lavandería", "lavanderia", 0.15)] } },
      ],
    }),
  },
  {
    id: "depto_1rec",
    nombre: "Departamento de 1 recámara",
    descripcion: "Sala-comedor y cocina de un lado; recámara y baño del otro.",
    construir: () => ({
      dir: "fila",
      partes: [
        { peso: 0.55, nodo: { dir: "columna", partes: [z("Sala-comedor", "sala", 0.6), z("Cocina", "cocina", 0.4)] } },
        { peso: 0.45, nodo: { dir: "columna", partes: [z("Recámara", "recamara", 0.62), z("Baño", "bano", 0.38)] } },
      ],
    }),
  },
  {
    id: "local",
    nombre: "Local comercial",
    descripcion: "Área de venta al frente; al fondo bodega, baño y oficina.",
    construir: () => ({
      dir: "fila",
      partes: [z("Área de venta", "otro", 0.68), { peso: 0.32, nodo: { dir: "columna", partes: [z("Bodega", "bodega", 0.5), z("Baño", "bano", 0.2), z("Oficina", "oficina", 0.3)] } }],
    }),
  },
  {
    id: "columnas",
    nombre: "Partes iguales, lado a lado",
    descripcion: "Divide en N columnas del mismo ancho.",
    param: { etiqueta: "Partes", min: 2, max: 12, def: 3 },
    construir: (n) => ({ dir: "columna", partes: repetir(n, () => z("Zona", "otro")) }),
  },
  {
    id: "filas",
    nombre: "Partes iguales, una sobre otra",
    descripcion: "Divide en N franjas del mismo alto.",
    param: { etiqueta: "Partes", min: 2, max: 12, def: 3 },
    construir: (n) => ({ dir: "fila", partes: repetir(n, () => z("Zona", "otro")) }),
  },
];

type Caja = { minX: number; maxX: number; minZ: number; maxZ: number };
type Hoja = { caja: Caja; zona: Zona };

const redondear = (v: number) => Math.round(v / PASO_M) * PASO_M;

function repartir(nodo: Nodo, caja: Caja, girar: boolean, out: Hoja[]): boolean {
  const horizontal = (nodo.dir === "fila") !== girar; // "fila": franjas apiladas en z
  const total = nodo.partes.reduce((s, p) => s + p.peso, 0);
  const ini = horizontal ? caja.minZ : caja.minX;
  const fin = horizontal ? caja.maxZ : caja.maxX;
  let acumulado = 0;
  let previo = ini;
  for (let i = 0; i < nodo.partes.length; i++) {
    const parte = nodo.partes[i];
    acumulado += parte.peso;
    const corte = i === nodo.partes.length - 1 ? fin : Math.min(fin, Math.max(previo, Math.round(redondear(ini + ((fin - ini) * acumulado) / total) * 10_000) / 10_000));
    if (corte - previo < LADO_MINIMO_M) return false;
    const sub: Caja = horizontal ? { ...caja, minZ: previo, maxZ: corte } : { ...caja, minX: previo, maxX: corte };
    if (parte.nodo) {
      if (!repartir(parte.nodo, sub, girar, out)) return false;
    } else if (parte.zona) {
      out.push({ caja: sub, zona: parte.zona });
    }
    previo = corte;
  }
  return true;
}

export type ResultadoPlantilla = { proyecto: Proyecto; ids: string[] } | { error: string };

/**
 * Reparte la zona `id` (debe ser un rectángulo) según la plantilla. La primera zona nueva conserva el id,
 * la altura y las fotos del cuarto original; puertas, ventanas y muebles pasan a la zona donde caen.
 */
export function aplicarPlantilla(proyecto: Proyecto, id: string, plantilla: Plantilla, n: number, girar: boolean): ResultadoPlantilla {
  const hab = proyecto.habitaciones.find((h) => h.id === id);
  if (!hab) return { error: "Elige primero una zona." };
  const rect = esRectangulo(hab);
  if (!rect) return { error: "Las plantillas solo se aplican a zonas rectangulares." };
  const hojas: Hoja[] = [];
  if (!repartir(plantilla.construir(n), rect, girar, hojas) || hojas.length === 0) {
    return { error: "La zona es muy chica para esa distribución (cada parte debe medir al menos 0.5 m). Prueba con menos partes o girándola." };
  }

  // Nombres: si un nombre se repite, se numera ("Oficina 1", "Oficina 2"…).
  const total = new Map<string, number>();
  for (const h of hojas) total.set(h.zona.nombre, (total.get(h.zona.nombre) ?? 0) + 1);
  const visto = new Map<string, number>();
  const puntosDe = (c: Caja): Point[] => [
    { x: c.minX, z: c.minZ },
    { x: c.maxX, z: c.minZ },
    { x: c.maxX, z: c.maxZ },
    { x: c.minX, z: c.maxZ },
  ];
  const partes: Point[][] = hojas.map((h) => puntosDe(h.caja));
  const aberturas = repartirAberturas(hab.aberturas, hab.puntos, partes);
  const nuevas: Habitacion[] = hojas.map((h, i) => {
    const k = (visto.get(h.zona.nombre) ?? 0) + 1;
    visto.set(h.zona.nombre, k);
    return {
      ...hab,
      id: i === 0 ? hab.id : crypto.randomUUID(),
      nombre: (total.get(h.zona.nombre) ?? 1) > 1 ? `${h.zona.nombre} ${k}` : h.zona.nombre,
      tipo: h.zona.tipo,
      puntos: partes[i],
      aberturas: aberturas[i],
    };
  });

  return {
    ids: nuevas.map((h) => h.id),
    proyecto: {
      ...proyecto,
      habitaciones: proyecto.habitaciones.flatMap((h) => (h.id === id ? nuevas : [h])),
      objetos: proyecto.objetos.map((o) => {
        if (o.habitacionId !== id) return o;
        const destino = nuevas.find((h) => pointInPolygon({ x: o.x, z: o.z }, h.puntos));
        return destino && destino.id !== id ? { ...o, habitacionId: destino.id } : o;
      }),
    },
  };
}
