// Piezas compartidas por los módulos de Backend con Supabase (ver supabaseBackend.js): constantes y ayudantes de este lado.
import { supabase } from "../../supabaseClient";
import { CLIENT_EXPEDIENTE_KEYS } from "../../clientExpedienteFields";
import { compressImageFile, compressImageFiles, makeImageVariants } from "../../imageCompression";
import { markVariantName, variantUrl } from "../../imageVariants";

// La tabla aún no existe en la base (falta correr su bloque de schema.sql):
// 42P01 es Postgres directo, PGRST205 es PostgREST ("no está en el schema cache").
export function isMissingTable(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

// PostgREST corta cualquier consulta en 1000 filas (el `max-rows` del proyecto) sin avisar: una lista del panel con más
// registros se vería "completa" pero le faltarían los más viejos. `fetchAll` pide por páginas hasta traerlo todo.
// `build` recibe la consulta base ya con su orden y devuelve la consulta lista; se vuelve a llamar por página.
export const PAGE_SIZE = 1000;
export const MAX_PAGES = 50; // tope de seguridad: 50 000 filas
export async function fetchAll(buildQuery) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

// Los campos del expediente del cliente (NSS, contraseña del portal, número
// de crédito y las 2 referencias) se guardan igual al crear y al editar — se
// arman desde una sola lista para no repetirlos campo por campo.
export function clientExpedientePayload(data) {
  return Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, data[key] || null]));
}

// Supabase Storage rechaza ciertos caracteres en la key del objeto (espacios,
// acentos, "{"/"}", etc. — el nombre real del archivo que sube el usuario no
// se puede meter tal cual en la ruta). Se sanitiza la base y se conserva la
// extensión real por separado, para no perder el tipo de archivo.
export function sanitizeFileName(name) {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : "";
  const safeBase =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "archivo";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

// El tercer parámetro va anotando cada archivo que ya quedó arriba, para
// que quien llama pueda deshacer las subidas si el guardado no llega a
// completarse (ver discardUploads).
export async function uploadFiles(bucket, files, uploaded, pathPrefix = "") {
  if (!files || files.length === 0) return [];
  // Solo esta función sube property-images/property-videos/advisor-photos
  // (documentos de clientes y adjuntos de Agenda suben por su cuenta más
  // abajo en este archivo) — comprimir aquí es seguro: compressImageFiles
  // deja pasar los videos tal cual, solo reencoda lo que sea una imagen.
  const compressed = await compressImageFiles(files);
  const urls = [];
  for (const file of compressed) {
    // Las fotos de propiedad llevan además copias WebP más chicas (lib/imageVariants.js); solo si se pudieron generar la foto
    // grande se sube con la marca «_rs» en el nombre, que es lo que avisa al sitio que existen.
    const variants = bucket === "property-images" ? await makeImageVariants(file) : null;
    const fileName = sanitizeFileName(file.name);
    const path = `${pathPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${variants ? markVariantName(fileName) : fileName}`;
    for (const variant of variants || []) {
      const variantPath = variantUrl(path, variant.width);
      const { error: variantError } = await supabase.storage.from(bucket).upload(variantPath, variant.file, { upsert: false, contentType: "image/webp" });
      if (variantError) throw variantError;
      uploaded?.push({ bucket, path: variantPath });
    }
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    uploaded?.push({ bucket, path });
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// Borra las subidas que ya se habían hecho cuando el guardado termina mal.
// A propósito no lanza: el error que le importa a quien llama es el que
// abortó el guardado, no un tropiezo al limpiar. Solo se llama mientras
// todavía no exista la fila que referencia los archivos — después del
// insert/update esos archivos ya están en uso y borrarlos rompería la
// propiedad guardada.
export async function discardUploads(uploaded) {
  const byBucket = new Map();
  for (const { bucket, path } of uploaded || []) {
    byBucket.set(bucket, [...(byBucket.get(bucket) || []), path]);
  }
  for (const [bucket, paths] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) console.error("discardUploads", bucket, paths, error);
  }
}

// Las imágenes se suben antes que los videos, así que un video rechazado
// por Storage (demasiado grande, MIME no permitido) dejaba las imágenes ya
// subidas sin dueño. Si cualquiera de las dos tandas falla, se deshace lo
// que alcanzó a subir.
export async function collectMedia(data, uploaded) {
  try {
    const newImages = await uploadFiles("property-images", data.imageFiles, uploaded);
    const newVideos = await uploadFiles("property-videos", data.videoFiles, uploaded);
    const newTour360 = await uploadFiles("property-360", data.tour360Files, uploaded);
    return {
      images: [...(data.existingImages || []), ...newImages],
      videos: [...(data.existingVideos || []), ...newVideos],
      tour_360_images: [...(data.existingTour360Images || []), ...newTour360],
    };
  } catch (err) {
    await discardUploads(uploaded);
    throw err;
  }
}

export function mapPropertyRow(row) {
  return {
    ...row,
    advisor_ids: (row.property_advisors || []).map((pa) => pa.advisor_id),
    advisors: (row.property_advisors || []).map((pa) => pa.advisors).filter(Boolean),
  };
}

// Del asesor, el público solo puede leer estas columnas (ver la migración 0118): teléfono, correo y WhatsApp salen por
// team_advisors() y selection_advisor(). El personal con sesión sí ve todo — el panel usa el teléfono del asesor (ficha en
// PDF, enviar propiedad, mensajes).
export const PUBLIC_ADVISOR_COLUMNS = "id, name, photo_url, bio, active, show_in_team, created_at";
export const PROPERTY_SELECT_STAFF = "*, property_advisors(advisor_id, advisors(*))";
export const PROPERTY_SELECT_PUBLIC = `*, property_advisors(advisor_id, advisors(${PUBLIC_ADVISOR_COLUMNS}))`;

// getSession() lee la sesión guardada en el navegador (sin red), así que es barato pedirla en cada consulta.
export async function hasStaffSession() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session);
}

export async function propertySelect() {
  return (await hasStaffSession()) ? PROPERTY_SELECT_STAFF : PROPERTY_SELECT_PUBLIC;
}

export const PROPERTY_SORTERS = {
  newest: [["created_at", false], ["id", true]],
  price_asc: [["price", true]],
  price_desc: [["price", false]],
  area_desc: [["area_m2", false]],
};

export const SECRETARIA_TABLES = { keys: "secretaria_llaves", docs: "secretaria_documentos" };

// Firma con URL de 1h (igual que property_log: el formulario puede quedarse
// abierto un rato capturando varios criterios) las filas del checklist que
// traen foto. Las que no tienen file_path se devuelven tal cual.
export async function signInspectionChecklist(checklist) {
  const withFile = (checklist || []).filter((e) => e.file_path);
  if (withFile.length === 0) return checklist || [];
  const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrls(withFile.map((e) => e.file_path), 3600);
  const urlByPath = new Map(withFile.map((e, i) => [e.file_path, signed?.[i]?.signedUrl || null]));
  return (checklist || []).map((e) => (e.file_path ? { ...e, signed_url: urlByPath.get(e.file_path) } : e));
}

// Sube la foto nueva de cada fila que traiga `file` (reemplazando la
// anterior si ya había una) y borra del bucket las fotos reemplazadas o
// quitadas explícitamente (`removed`). Si una subida falla a la mitad, se
// deshacen las que sí alcanzaron a subir en esta misma llamada — igual que
// discardUploads con las imágenes/videos de una propiedad.
export async function uploadInspectionChecklistPhotos(inspectionId, checklist) {
  const uploaded = [];
  const toRemove = [];
  const result = [];
  try {
    for (const entry of checklist) {
      if (entry.file) {
        const prepared = await compressImageFile(entry.file);
        const path = `${inspectionId}/${entry.category}-${entry.key}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("inspection-photos")
          .upload(path, prepared, { contentType: prepared.type || "image/jpeg", upsert: false });
        if (error) throw error;
        uploaded.push(path);
        if (entry.file_path) toRemove.push(entry.file_path);
        result.push({ category: entry.category, key: entry.key, estado: entry.estado, file_path: path });
      } else if (entry.removed && entry.file_path) {
        toRemove.push(entry.file_path);
        result.push({ category: entry.category, key: entry.key, estado: entry.estado, file_path: null });
      } else {
        result.push({ category: entry.category, key: entry.key, estado: entry.estado, file_path: entry.file_path || null });
      }
    }
  } catch (err) {
    if (uploaded.length) await supabase.storage.from("inspection-photos").remove(uploaded);
    throw err;
  }
  if (toRemove.length) await supabase.storage.from("inspection-photos").remove(toRemove);
  return result;
}
