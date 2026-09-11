// Comprime fotos de propiedades/asesores/tipos de propiedad antes de
// subirlas (reescala al lado más largo a MAX_DIMENSION y reencoda a JPEG) —
// una foto de celular sin comprimir (5-10MB) se serviría tal cual en las
// tarjetas y galería del sitio público. Deliberadamente NO se usa dentro
// de los helpers genéricos de subida (uploadFiles/filesToDataUrls en cada
// backend) porque esos mismos helpers también suben documentos de
// identidad (DocumentCapture ya tiene su propia validación de nitidez —
// comprimir ahí perjudicaría la legibilidad) y adjuntos de Agenda (pueden
// ser PDFs, no siempre imágenes); por eso se llama explícitamente solo en
// los puntos que sí son fotos de exhibición pública.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export async function compressImageFile(file) {
  if (!file.type?.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function compressImageFiles(files) {
  if (!files || files.length === 0) return [];
  return Promise.all(Array.from(files).map(compressImageFile));
}
