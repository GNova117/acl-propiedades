// Material para redes sociales a partir de una propiedad: texto de la
// publicación y una imagen vertical (1080×1350, la más usada en Instagram y
// Facebook) con el precio y los datos sobre la foto. Todo se arma en el
// navegador; no publica nada por sí mismo (Facebook e Instagram no permiten
// publicar desde una página web sin una integración con su API).

import { formatArea, formatMXN } from "./format";
import { OFFICE_WHATSAPP } from "./office";

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;

const OFFICE_PHONE_TEXT = `${OFFICE_WHATSAPP.slice(2, 5)} ${OFFICE_WHATSAPP.slice(5, 8)} ${OFFICE_WHATSAPP.slice(8)}`;

const isRent = (property) => property.operation_type === "renta";

const TYPE_HASHTAGS = {
  casa: ["#Casa"],
  departamento: ["#Departamento"],
  nave_industrial: ["#NaveIndustrial"],
  terreno: ["#Terreno"],
};

const cleanTag = (text) =>
  `#${String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")}`;

export function propertyUrl(property, origin) {
  return `${origin}/propiedades/${property.id}`;
}

function specsLine(property) {
  const parts = [];
  if (Number(property.bedrooms) > 0) parts.push(`🛏 ${property.bedrooms} recámara${Number(property.bedrooms) === 1 ? "" : "s"}`);
  if (Number(property.bathrooms) > 0) parts.push(`🛁 ${property.bathrooms} baño${Number(property.bathrooms) === 1 ? "" : "s"}`);
  if (Number(property.parking) > 0) parts.push(`🚗 ${property.parking} cochera${Number(property.parking) === 1 ? "" : "s"}`);
  if (Number(property.area_m2) > 0) parts.push(`📐 ${formatArea(property.area_m2)}`);
  return parts.join(" · ");
}

// Texto listo para pegar. `origin` es el dominio del sitio (para el enlace).
export function buildCaption(property, { origin }) {
  const rent = isRent(property);
  const description = String(property.description || "").replace(/\s+/g, " ").trim();
  const short = description.length > 200 ? `${description.slice(0, 197).trimEnd()}…` : description;
  const opTag = rent ? "EnRenta" : "EnVenta";
  const typeTag = (TYPE_HASHTAGS[property.type] || ["#Propiedad"])[0] + opTag;
  const tags = ["#BienesRaíces", "#LaComarcaLagunera", property.zone ? cleanTag(property.zone) : null, typeTag, "#ACLPropiedades"].filter(Boolean);

  return [
    `🏡 ${String(property.title || "").trim()}${property.code ? ` (${property.code})` : ""}`,
    property.zone ? `📍 ${property.zone}` : null,
    `💰 ${formatMXN(property.price)}${rent ? " al mes" : ""}`,
    specsLine(property) || null,
    short ? `\n${short}` : null,
    `\n📲 Más fotos y datos: ${propertyUrl(property, origin)}`,
    `💬 WhatsApp: ${OFFICE_PHONE_TEXT}`,
    `\n${tags.join(" ")}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function loadImageBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar la foto");
  return createImageBitmap(await res.blob());
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

// Dibuja la publicación en un canvas de 1080×1350 y lo devuelve.
export async function renderPostCanvas(property, imageUrl) {
  const bitmap = await loadImageBitmap(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = POST_WIDTH;
  canvas.height = POST_HEIGHT;
  const ctx = canvas.getContext("2d");
  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

  // Foto a pantalla completa (recorte centrado, como "cover").
  const scale = Math.max(POST_WIDTH / bitmap.width, POST_HEIGHT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (POST_WIDTH - w) / 2, (POST_HEIGHT - h) / 2, w, h);

  // Degradado inferior para que el texto se lea sobre cualquier foto.
  const gradient = ctx.createLinearGradient(0, POST_HEIGHT * 0.5, 0, POST_HEIGHT);
  gradient.addColorStop(0, "rgba(6, 12, 28, 0)");
  gradient.addColorStop(0.55, "rgba(6, 12, 28, 0.82)");
  gradient.addColorStop(1, "rgba(6, 12, 28, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, POST_HEIGHT * 0.5, POST_WIDTH, POST_HEIGHT * 0.5);

  // Etiqueta EN VENTA / EN RENTA
  const badge = isRent(property) ? "EN RENTA" : "EN VENTA";
  ctx.font = `800 40px ${font}`;
  const badgeW = ctx.measureText(badge).width + 64;
  ctx.fillStyle = "#1565c0";
  ctx.beginPath();
  ctx.roundRect(56, 56, badgeW, 76, 38);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(badge, 88, 96);

  // Bloque de texto inferior
  ctx.textBaseline = "alphabetic";
  const left = 64;
  const maxW = POST_WIDTH - left * 2;
  let y = POST_HEIGHT - 64;

  // Marca
  ctx.font = `800 34px ${font}`;
  ctx.fillStyle = "#fff";
  ctx.fillText("ACL PROPIEDADES", left, y);
  ctx.font = `500 32px ${font}`;
  ctx.fillStyle = "#c9d3e2";
  const phone = OFFICE_PHONE_TEXT;
  ctx.fillText(phone, POST_WIDTH - left - ctx.measureText(phone).width, y);
  y -= 40;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(left, y, maxW, 2);
  y -= 34;

  // Datos
  const specs = [
    Number(property.bedrooms) > 0 ? `${property.bedrooms} rec.` : null,
    Number(property.bathrooms) > 0 ? `${property.bathrooms} baños` : null,
    Number(property.parking) > 0 ? `${property.parking} coch.` : null,
    Number(property.area_m2) > 0 ? formatArea(property.area_m2) : null,
  ].filter(Boolean);
  ctx.font = `600 36px ${font}`;
  ctx.fillStyle = "#e8eef8";
  const meta = [property.zone, ...specs].filter(Boolean).join("  ·  ");
  for (const line of wrapLines(ctx, meta, maxW, 2).reverse()) {
    ctx.fillText(line, left, y);
    y -= 46;
  }
  y -= 6;

  // Título
  ctx.font = `700 46px ${font}`;
  ctx.fillStyle = "#fff";
  for (const line of wrapLines(ctx, property.title, maxW, 2).reverse()) {
    ctx.fillText(line, left, y);
    y -= 56;
  }
  y -= 8;

  // Precio
  ctx.font = `900 96px ${font}`;
  ctx.fillStyle = "#fff";
  ctx.fillText(`${formatMXN(property.price)}${isRent(property) ? " /mes" : ""}`, left, y);

  return canvas;
}

export const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.92) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), type, quality));

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const postFileName = (property, suffix = "") => {
  const base = String(property.code || property.title || "propiedad")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${base || "propiedad"}${suffix}`;
};
