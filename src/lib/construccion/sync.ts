// Solo lo importa src/lib/supabaseBackend.js (expone db.getConstruccion*/etc.) — las páginas
// nunca llaman a `supabase` directo, igual que cada otro dominio de este backend.
import { supabase } from "../supabaseClient";
import { compressImageFile } from "../imageCompression";
import { wallSegmentsFromPolygon, type Point } from "./geometry";
import type { Abertura, FotoHabitacion, FuenteCantidad, Habitacion, MaterialCatalogItem, Nivel, Objeto, Proyecto, TipoAbertura, TipoHabitacion } from "./types";
import { ZONAS } from "./objetos";
import { normalizarNiveles } from "./niveles";

const DEFAULT_ESPESOR_M = 0.15;

function requireSupabase() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

type ProyectoRow = { id: string; nombre: string; cliente: string | null; direccion: string | null; created_at: string };
type MuroRow = { id: string; habitacion_id: string; puntos: [Point, Point]; altura: number; orden: number };
type AberturaRow = {
  id: string;
  muro_id: string;
  tipo: TipoAbertura;
  offset_m: number;
  ancho: number;
  alto: number;
  alto_desde_piso: number;
};

type NivelRow = { id: string; nombre: string; orden: number };

type ObjetoRow = {
  id: string;
  nivel_id?: string | null;
  habitacion_id: string | null;
  tipo: string;
  x: number;
  z: number;
  ancho: number;
  largo: number;
  rot_deg: number;
};

/** La tabla construccion_objetos es posterior al resto: si el SQL aún no se corrió, se trabaja sin objetos. */
function tablaObjetosFaltante(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /construccion_objetos/.test(e.message ?? ""));
}

const MSG_FALTA_TABLA_OBJETOS =
  "Falta crear la tabla construccion_objetos en Supabase (corre el bloque de objetos de supabase/schema.sql) para guardar los muebles.";

function tablaNivelesFaltante(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /construccion_niveles/.test(e.message ?? ""));
}

const MSG_FALTA_TABLA_NIVELES =
  "Falta crear la tabla construccion_niveles en Supabase (corre el bloque «Construcción · niveles» de supabase/schema.sql) para guardar más de un nivel.";

/**
 * ¿Ya existe la tabla de niveles (y con ella las columnas nivel_id)? El bloque SQL las crea juntas. Mientras
 * no exista, todo funciona con un solo nivel implícito ("Planta baja"), igual que antes de esta función.
 */
async function nivelesDisponibles(db: NonNullable<typeof supabase>): Promise<boolean> {
  const { error } = await db.from("construccion_niveles").select("id").limit(1);
  if (!error) return true;
  if (tablaNivelesFaltante(error)) return false;
  throw error;
}

async function fetchObjetos(db: NonNullable<typeof supabase>, proyectoId: string, conNiveles: boolean): Promise<Objeto[]> {
  const { data, error } = await db
    .from("construccion_objetos")
    .select(conNiveles ? "id, nivel_id, habitacion_id, tipo, x, z, ancho, largo, rot_deg" : "id, habitacion_id, tipo, x, z, ancho, largo, rot_deg")
    .eq("proyecto_id", proyectoId);
  if (error) {
    if (tablaObjetosFaltante(error)) return [];
    throw error;
  }
  return ((data ?? []) as unknown as ObjetoRow[]).map((o) => ({
    id: o.id,
    nivelId: o.nivel_id ?? "",
    tipo: o.tipo,
    habitacionId: o.habitacion_id,
    x: Number(o.x),
    z: Number(o.z),
    anchoM: Number(o.ancho),
    largoM: Number(o.largo),
    rotDeg: Number(o.rot_deg),
  }));
}

export type ProyectoResumen = { id: string; nombre: string; cliente: string | null; direccion: string | null; createdAt: string };

/** Lista liviana para la tabla de proyectos — sin geometría, una sola consulta. */
export async function getConstruccionProyectos(): Promise<ProyectoResumen[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("construccion_proyectos")
    .select("id, nombre, cliente, direccion, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProyectoRow[]).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    cliente: p.cliente,
    direccion: p.direccion,
    createdAt: p.created_at,
  }));
}

export async function addConstruccionProyecto(input: { nombre: string; cliente?: string; direccion?: string }): Promise<string> {
  const db = requireSupabase();
  const id = crypto.randomUUID();
  const { error } = await db.from("construccion_proyectos").insert({
    id,
    nombre: input.nombre,
    cliente: input.cliente || null,
    direccion: input.direccion || null,
  });
  if (error) throw error;
  return id;
}

export async function deleteConstruccionProyecto(id: string): Promise<void> {
  const db = requireSupabase();
  // Las filas de construccion_fotos se van en cascada (proyecto_id), pero sus
  // archivos en Storage no — se borran a mano antes, o quedan huérfanos.
  const { data: fotos } = await db.from("construccion_fotos").select("file_path").eq("proyecto_id", id);
  const paths = ((fotos ?? []) as { file_path: string }[]).map((f) => f.file_path);
  if (paths.length > 0) await db.storage.from("construccion-fotos").remove(paths);
  const { error } = await db.from("construccion_proyectos").delete().eq("id", id);
  if (error) throw error;
}

/** Descarga un proyecto completo y lo reconstruye en la forma local (Proyecto/Habitacion/Abertura). */
export async function getConstruccionProyecto(proyectoId: string): Promise<Proyecto | null> {
  const db = requireSupabase();

  const { data: proyectoRow, error: proyectoError } = await db
    .from("construccion_proyectos")
    .select("id, nombre, cliente, direccion")
    .eq("id", proyectoId)
    .maybeSingle();
  if (proyectoError) throw proyectoError;
  if (!proyectoRow) return null;
  const { id, nombre, cliente, direccion } = proyectoRow as { id: string; nombre: string; cliente: string | null; direccion: string | null };

  const conNiveles = await nivelesDisponibles(db);
  let niveles: Nivel[] = [];
  if (conNiveles) {
    const { data: nivelesData, error: nivError } = await db
      .from("construccion_niveles")
      .select("id, nombre, orden")
      .eq("proyecto_id", id)
      .order("orden", { ascending: true });
    if (nivError) throw nivError;
    niveles = ((nivelesData ?? []) as NivelRow[]).map((n) => ({ id: n.id, nombre: n.nombre }));
  }

  const { data: habitacionesData, error: habError } = await db
    .from("construccion_habitaciones")
    .select(conNiveles ? "id, nombre, tipo, nivel_id" : "id, nombre, tipo")
    .eq("proyecto_id", id);
  if (habError) throw habError;
  const habitacionesRows = (habitacionesData ?? []) as unknown as { id: string; nombre: string; tipo: string | null; nivel_id?: string | null }[];
  const habitacionIds = habitacionesRows.map((h) => h.id);
  const objetos = await fetchObjetos(db, id, conNiveles);
  // Un proyecto guardado antes de que existieran los niveles no trae ninguno: se le crea "Planta baja".
  if (habitacionIds.length === 0) return normalizarNiveles({ id, nombre, cliente, direccion, niveles, habitaciones: [], objetos });

  const { data: murosData, error: murosError } = await db
    .from("construccion_muros")
    .select("id, habitacion_id, puntos, altura, orden")
    .in("habitacion_id", habitacionIds)
    .order("orden", { ascending: true });
  if (murosError) throw murosError;
  const muros = (murosData ?? []) as MuroRow[];
  const muroIds = muros.map((m) => m.id);

  let aberturas: AberturaRow[] = [];
  if (muroIds.length > 0) {
    const { data: aberturasData, error: abError } = await db
      .from("construccion_aberturas")
      .select("id, muro_id, tipo, offset_m, ancho, alto, alto_desde_piso")
      .in("muro_id", muroIds);
    if (abError) throw abError;
    aberturas = (aberturasData ?? []) as AberturaRow[];
  }

  const habitaciones: Habitacion[] = habitacionesRows.map((h) => {
    const susMuros = muros.filter((m) => m.habitacion_id === h.id);
    const puntos = susMuros.map((m) => m.puntos[0]);
    const indexPorMuroId = new Map(susMuros.map((m, i) => [m.id, i]));
    const susAberturas: Abertura[] = aberturas
      .filter((a) => indexPorMuroId.has(a.muro_id))
      .map((a) => ({
        id: a.id,
        segmentIndex: indexPorMuroId.get(a.muro_id) as number,
        tipo: a.tipo,
        offsetM: a.offset_m,
        anchoM: a.ancho,
        altoM: a.alto,
        altoDesdePisoM: a.alto_desde_piso,
      }));
    return {
      id: h.id,
      nivelId: h.nivel_id ?? "",
      nombre: h.nombre,
      tipo: ZONAS.some((z) => z.id === h.tipo) ? (h.tipo as TipoHabitacion) : undefined,
      puntos,
      alturaM: susMuros[0]?.altura ?? 2.5,
      aberturas: susAberturas,
    };
  });

  return normalizarNiveles({ id, nombre, cliente, direccion, niveles, habitaciones, objetos });
}

async function pushHabitacion(db: NonNullable<typeof supabase>, proyectoId: string, habitacion: Habitacion, conNiveles: boolean) {
  const { error: habError } = await db.from("construccion_habitaciones").insert({
    id: habitacion.id,
    proyecto_id: proyectoId,
    nombre: habitacion.nombre,
    tipo: habitacion.tipo ?? null,
    ...(conNiveles ? { nivel_id: habitacion.nivelId } : {}),
  });
  if (habError) throw habError;

  const segments = wallSegmentsFromPolygon(habitacion.puntos);
  const muroIds = segments.map(() => crypto.randomUUID());

  if (segments.length > 0) {
    const muroRows = segments.map((seg, i) => ({
      id: muroIds[i],
      habitacion_id: habitacion.id,
      puntos: [seg.start, seg.end],
      altura: habitacion.alturaM,
      espesor: DEFAULT_ESPESOR_M,
      orden: i,
    }));
    const { error: murosError } = await db.from("construccion_muros").insert(muroRows);
    if (murosError) throw murosError;
  }

  const aberturaRows = habitacion.aberturas
    .filter((a) => muroIds[a.segmentIndex] !== undefined)
    .map((a) => ({
      id: a.id,
      muro_id: muroIds[a.segmentIndex],
      tipo: a.tipo,
      offset_m: a.offsetM,
      ancho: a.anchoM,
      alto: a.altoM,
      alto_desde_piso: a.altoDesdePisoM,
    }));
  if (aberturaRows.length > 0) {
    const { error: abError } = await db.from("construccion_aberturas").insert(aberturaRows);
    if (abError) throw abError;
  }
}

/**
 * Sube el proyecto completo: actualiza el nombre, y reemplaza por completo sus habitaciones
 * (se borran las existentes — cascada hasta muros/aberturas — y se reinsertan desde el estado
 * local, que es la fuente de verdad mientras se edita).
 */
export async function pushConstruccionProyecto(proyecto: Proyecto): Promise<void> {
  const db = requireSupabase();

  // Antes de borrar nada: sin la tabla de niveles solo se puede guardar el caso de un nivel (como antes).
  const conNiveles = await nivelesDisponibles(db);
  if (!conNiveles && proyecto.niveles.length > 1) throw new Error(MSG_FALTA_TABLA_NIVELES);

  const { error: updateError } = await db
    .from("construccion_proyectos")
    .update({ nombre: proyecto.nombre, updated_at: new Date().toISOString() })
    .eq("id", proyecto.id);
  if (updateError) throw updateError;

  const { data: habitacionesExistentes, error: habError } = await db
    .from("construccion_habitaciones")
    .select("id")
    .eq("proyecto_id", proyecto.id);
  if (habError) throw habError;
  const idsExistentes = ((habitacionesExistentes ?? []) as { id: string }[]).map((h) => h.id);
  if (idsExistentes.length > 0) {
    const { error: deleteError } = await db.from("construccion_habitaciones").delete().in("id", idsExistentes);
    if (deleteError) throw deleteError;
  }

  // Los niveles se reemplazan igual que las habitaciones, pero ANTES de reinsertarlas (nivel_id los referencia).
  if (conNiveles) {
    const { error: delNivError } = await db.from("construccion_niveles").delete().eq("proyecto_id", proyecto.id);
    if (delNivError) throw delNivError;
    const { error: insNivError } = await db.from("construccion_niveles").insert(
      proyecto.niveles.map((n, i) => ({ id: n.id, proyecto_id: proyecto.id, nombre: n.nombre, orden: i })),
    );
    if (insNivError) throw insNivError;
  }

  for (const habitacion of proyecto.habitaciones) {
    await pushHabitacion(db, proyecto.id, habitacion, conNiveles);
  }

  // Los objetos van después de las habitaciones (habitacion_id las referencia, y se reinsertaron arriba).
  const { error: delObjError } = await db.from("construccion_objetos").delete().eq("proyecto_id", proyecto.id);
  if (delObjError) {
    if (!tablaObjetosFaltante(delObjError)) throw delObjError;
    if (proyecto.objetos.length > 0) throw new Error(MSG_FALTA_TABLA_OBJETOS);
    return;
  }
  if (proyecto.objetos.length > 0) {
    const ids = new Set(proyecto.habitaciones.map((h) => h.id));
    const { error: insObjError } = await db.from("construccion_objetos").insert(
      proyecto.objetos.map((o) => ({
        id: o.id,
        proyecto_id: proyecto.id,
        ...(conNiveles ? { nivel_id: o.nivelId } : {}),
        habitacion_id: o.habitacionId && ids.has(o.habitacionId) ? o.habitacionId : null,
        tipo: o.tipo,
        x: o.x,
        z: o.z,
        ancho: o.anchoM,
        largo: o.largoM,
        rot_deg: o.rotDeg,
      })),
    );
    if (insObjError) throw insObjError;
  }
}

// ─────────────────────────────────────────────
// Fotos por habitación (para el reporte con membrete). `habitacion_id` NO es
// una llave foránea con cascada a propósito: pushConstruccionProyecto borra y
// reinserta las habitaciones en cada guardado (aunque conserven el mismo id),
// y si la tabla cascadeara por ahí se perderían las fotos con cada edición del
// plano. La única cascada real es por proyecto_id, al borrar el proyecto
// completo (storage.remove() en deleteConstruccionProyecto cubre lo que la
// cascada no toca: los archivos del bucket).
// ─────────────────────────────────────────────

type FotoRow = { id: string; habitacion_id: string; file_path: string; nota: string | null; orden: number; created_at: string };

const BUCKET_FOTOS = "construccion-fotos";
const SIGNED_URL_TTL_S = 300;

// Cubre tanto la tabla faltante (error de Postgrest) como el bucket faltante
// (error de Storage) — ambos salen del mismo bloque SQL sin correr todavía.
function tablaFotosFaltante(err: unknown): boolean {
  const e = err as { code?: string; message?: string; statusCode?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || /construccion_fotos/.test(e.message ?? "")) return true;
  return e.statusCode === "404" || /bucket not found/i.test(e.message ?? "");
}

const MSG_FALTA_TABLA_FOTOS =
  "Falta crear la tabla construccion_fotos en Supabase (corre el bloque «Construcción · fotos por cuarto» de supabase/schema.sql) para guardar fotos.";

/** Fotos de las habitaciones dadas, agrupadas por habitacionId, con su URL firmada (5 min). */
export async function getConstruccionFotos(habitacionIds: string[]): Promise<Record<string, FotoHabitacion[]>> {
  if (habitacionIds.length === 0) return {};
  const db = requireSupabase();
  const { data, error } = await db
    .from("construccion_fotos")
    .select("id, habitacion_id, file_path, nota, orden, created_at")
    .in("habitacion_id", habitacionIds)
    .order("orden", { ascending: true });
  if (error) {
    if (tablaFotosFaltante(error)) return {};
    throw error;
  }
  const rows = (data ?? []) as FotoRow[];
  if (rows.length === 0) return {};

  const paths = rows.map((r) => r.file_path);
  const { data: signed } = await db.storage.from(BUCKET_FOTOS).createSignedUrls(paths, SIGNED_URL_TTL_S);
  const urlByPath = new Map((signed ?? []).map((s, i) => [paths[i], s.signedUrl || null]));

  const out: Record<string, FotoHabitacion[]> = {};
  for (const r of rows) {
    const foto: FotoHabitacion = {
      id: r.id,
      habitacionId: r.habitacion_id,
      filePath: r.file_path,
      nota: r.nota,
      orden: r.orden,
      createdAt: r.created_at,
      signedUrl: urlByPath.get(r.file_path) ?? null,
    };
    (out[r.habitacion_id] ??= []).push(foto);
  }
  return out;
}

/** Sube una foto (comprimida como las de exhibición pública) y la guarda con su nota. */
export async function addConstruccionFoto(input: {
  proyectoId: string;
  habitacionId: string;
  file: File;
  nota: string;
  orden: number;
}): Promise<FotoHabitacion> {
  const db = requireSupabase();
  const comprimida = await compressImageFile(input.file);
  const ext = (comprimida.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${input.proyectoId}/${input.habitacionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET_FOTOS)
    .upload(path, comprimida, { contentType: comprimida.type || "image/jpeg", upsert: false });
  if (uploadError) {
    if (tablaFotosFaltante(uploadError)) throw new Error(MSG_FALTA_TABLA_FOTOS);
    throw uploadError;
  }

  const { data, error } = await db
    .from("construccion_fotos")
    .insert({ proyecto_id: input.proyectoId, habitacion_id: input.habitacionId, file_path: path, nota: input.nota || null, orden: input.orden })
    .select("id, habitacion_id, file_path, nota, orden, created_at")
    .single();
  if (error) {
    await db.storage.from(BUCKET_FOTOS).remove([path]);
    if (tablaFotosFaltante(error)) throw new Error(MSG_FALTA_TABLA_FOTOS);
    throw error;
  }
  const row = data as FotoRow;
  const { data: signed } = await db.storage.from(BUCKET_FOTOS).createSignedUrls([path], SIGNED_URL_TTL_S);
  return {
    id: row.id,
    habitacionId: row.habitacion_id,
    filePath: row.file_path,
    nota: row.nota,
    orden: row.orden,
    createdAt: row.created_at,
    signedUrl: signed?.[0]?.signedUrl || null,
  };
}

export async function updateConstruccionFotoNota(id: string, nota: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("construccion_fotos").update({ nota: nota || null }).eq("id", id);
  if (error) throw error;
}

export async function deleteConstruccionFoto(id: string): Promise<void> {
  const db = requireSupabase();
  const { data: foto } = await db.from("construccion_fotos").select("file_path").eq("id", id).maybeSingle();
  if (foto?.file_path) await db.storage.from(BUCKET_FOTOS).remove([foto.file_path]);
  const { error } = await db.from("construccion_fotos").delete().eq("id", id);
  if (error) throw error;
}

/** Al eliminar una habitación en el editor: limpia sus fotos (la tabla no cascada por su cuenta, ver nota arriba). */
export async function deleteConstruccionFotosDeHabitacion(habitacionId: string): Promise<void> {
  const db = requireSupabase();
  const { data: fotos } = await db.from("construccion_fotos").select("id, file_path").eq("habitacion_id", habitacionId);
  const rows = (fotos ?? []) as { id: string; file_path: string }[];
  if (rows.length === 0) return;
  await db.storage.from(BUCKET_FOTOS).remove(rows.map((f) => f.file_path));
  const { error } = await db.from("construccion_fotos").delete().in(
    "id",
    rows.map((f) => f.id),
  );
  if (error) throw error;
}

type CatalogoRow = {
  id: string;
  nombre: string;
  unidad: string;
  fuente: FuenteCantidad;
  factor: number;
  precio_unitario: number;
};

/** `null` si la tabla está vacía (todavía no se ha subido ningún catálogo). */
export async function getConstruccionCatalogo(): Promise<MaterialCatalogItem[] | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("construccion_catalogo_materiales")
    .select("id, nombre, unidad, fuente, factor, precio_unitario")
    .order("nombre", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as CatalogoRow[];
  if (rows.length === 0) return null;
  return rows.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    unidad: m.unidad,
    fuente: m.fuente,
    factor: m.factor,
    precioUnitario: m.precio_unitario,
  }));
}

/** Reemplaza el catálogo remoto por el local (borra lo que ya no existe, upsert del resto). */
export async function pushConstruccionCatalogo(catalogo: MaterialCatalogItem[]): Promise<void> {
  const db = requireSupabase();

  const { data: existentes, error: existentesError } = await db.from("construccion_catalogo_materiales").select("id");
  if (existentesError) throw existentesError;
  const idsActuales = new Set(catalogo.map((m) => m.id));
  const idsAEliminar = ((existentes ?? []) as { id: string }[]).map((e) => e.id).filter((id) => !idsActuales.has(id));
  if (idsAEliminar.length > 0) {
    const { error } = await db.from("construccion_catalogo_materiales").delete().in("id", idsAEliminar);
    if (error) throw error;
  }

  if (catalogo.length > 0) {
    const { error } = await db.from("construccion_catalogo_materiales").upsert(
      catalogo.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        unidad: m.unidad,
        fuente: m.fuente,
        factor: m.factor,
        precio_unitario: m.precioUnitario,
      })),
    );
    if (error) throw error;
  }
}

/** Los errores de supabase-js (PostgrestError) no son instancias de Error — extrae un mensaje real. */
export function describeSyncError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; hint?: unknown; code?: unknown };
    const parts = [e.message, e.hint].filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length > 0) return parts.join(" — ");
    if (typeof e.code === "string") return `Error de Supabase (código ${e.code})`;
  }
  return String(err);
}
