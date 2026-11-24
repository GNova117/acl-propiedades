// Imágenes para la vista previa al compartir un enlace (WhatsApp, Facebook, etc.), de 1200 × 630:
//   • la de la MARCA (public/og-default.png, hecha con scripts/build-og-image.mjs): para el inicio y las páginas sin foto;
//   • la de una PROPIEDAD (api/og.js): su foto con el precio y los datos encima, para que el cliente vea de qué se trata
//     antes de abrir el enlace.
// El dibujo es una función pura sobre un canvas que se le pasa (así se prueba y se usa igual en el script y en la función).
import { ACL_LOGO_ACCENT_PATH, ACL_LOGO_BASE_PATH, ACL_LOGO_VIEWBOX } from "../src/lib/aclLogoPaths.js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const FONT = '"ACL Inter"';

const NAVY = "#0a1120";
const BLUE = "#0d3b73";
const LIGHT_BLUE = "#2f9bdc";

// Registra las fuentes incluidas en el repositorio (el servidor no trae fuentes propias). `GlobalFonts` de @napi-rs/canvas.
export function registerFonts(GlobalFonts, dir) {
  const base = dir.endsWith("/") ? dir : `${dir}/`;
  GlobalFonts.registerFromPath(`${base}Inter-Bold.otf`, "ACL Inter");
  GlobalFonts.registerFromPath(`${base}Inter-Medium.otf`, "ACL Inter");
}

// El logo (las dos piezas) dentro de la caja { x, y, width }, en blanco con el detalle en azul claro.
function drawLogo(ctx, Path2D, { x, y, width }) {
  const box = ACL_LOGO_VIEWBOX;
  const k = width / box.width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-box.x, -box.y);
  ctx.fillStyle = LIGHT_BLUE;
  ctx.fill(new Path2D(ACL_LOGO_ACCENT_PATH), "evenodd");
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(ACL_LOGO_BASE_PATH), "evenodd");
  ctx.restore();
  return box.height * k;
}

// Parte un texto en renglones que quepan en `maxWidth` (a lo más `maxLines`; lo que sobre se corta con «…»).
export function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, "")}…`;
    return kept;
  }
  return lines;
}

// Fondo de la marca: degradado azul noche con luz suave.
function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, OG_WIDTH, OG_HEIGHT);
  g.addColorStop(0, NAVY);
  g.addColorStop(1, BLUE);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
  const glow = ctx.createRadialGradient(OG_WIDTH * 0.85, OG_HEIGHT * 0.15, 20, OG_WIDTH * 0.85, OG_HEIGHT * 0.15, 520);
  glow.addColorStop(0, "rgba(47, 155, 220, 0.35)");
  glow.addColorStop(1, "rgba(47, 155, 220, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
}

// La imagen de la marca (sin foto).
export function drawBrandCard(ctx, Path2D) {
  drawBackground(ctx);
  drawLogo(ctx, Path2D, { x: 90, y: 70, width: 640 });
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 40px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const lines = wrapText(ctx, "Casas, departamentos, terrenos y naves industriales", 960, 2);
  lines.forEach((line, i) => ctx.fillText(line, 90, 420 + i * 50));
  ctx.fillStyle = "#8fc9ee";
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText("Torreón · Gómez Palacio · Lerdo", 90, 420 + lines.length * 50 + 24);
  ctx.fillStyle = LIGHT_BLUE;
  ctx.fillRect(90, 580, 120, 6);
}

// «cover»: la foto llena el cuadro sin deformarse (se recorta lo que sobre).
function drawCover(ctx, image) {
  const scale = Math.max(OG_WIDTH / image.width, OG_HEIGHT / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (OG_WIDTH - w) / 2, (OG_HEIGHT - h) / 2, w, h);
}

const mxn = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(value) || 0);
const num = (value) => (Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value)));

// Los datos de la propiedad en un renglón: «3 rec · 2.5 baños · 2 autos · 180 m² · Torreón».
export function propertyFacts(property) {
  const parts = [];
  const isHome = property.type === "casa" || property.type === "departamento";
  if (isHome && Number(property.bedrooms) > 0) parts.push(`${num(property.bedrooms)} rec`);
  if (isHome && Number(property.bathrooms) > 0) parts.push(`${num(property.bathrooms)} baños`);
  if (isHome && Number(property.parking) > 0) parts.push(`${num(property.parking)} autos`);
  if (Number(property.area_m2) > 0) parts.push(`${Number(property.area_m2).toLocaleString("es-MX")} m²`);
  if (property.zone) parts.push(property.zone);
  return parts.join(" · ");
}

// Foto de la propiedad con el precio, el título y los datos encima. `photo` es un Image del canvas (o null: sin foto se
// usa el fondo de la marca, que sigue mostrando todo lo demás). Tipo y operación salen como etiqueta arriba.
export function drawPropertyCard(ctx, Path2D, { photo, property }) {
  if (photo) drawCover(ctx, photo);
  else drawBackground(ctx);

  // Degradado oscuro abajo para que el texto se lea sobre cualquier foto.
  const shade = ctx.createLinearGradient(0, OG_HEIGHT * 0.3, 0, OG_HEIGHT);
  shade.addColorStop(0, "rgba(5, 10, 20, 0)");
  shade.addColorStop(1, "rgba(5, 10, 20, 0.92)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, OG_HEIGHT * 0.3, OG_WIDTH, OG_HEIGHT * 0.7);

  // Etiqueta arriba a la izquierda: «En venta» / «En renta» y el logo en una cinta.
  const rent = property.operation_type === "renta";
  ctx.font = `700 26px ${FONT}`;
  const label = rent ? "EN RENTA" : "EN VENTA";
  const labelWidth = ctx.measureText(label).width + 40;
  ctx.fillStyle = LIGHT_BLUE;
  ctx.beginPath();
  ctx.roundRect(40, 36, labelWidth, 52, 10);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 60, 63);

  ctx.fillStyle = "rgba(10, 17, 32, 0.78)";
  ctx.beginPath();
  ctx.roundRect(OG_WIDTH - 40 - 250, 30, 250, 66, 12);
  ctx.fill();
  drawLogo(ctx, Path2D, { x: OG_WIDTH - 40 - 250 + 20, y: 41, width: 210 });

  // Precio (grande), título y datos.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 84px ${FONT}`;
  ctx.fillText(mxn(property.price), 48, 460);
  ctx.font = `700 38px ${FONT}`;
  const titleLines = wrapText(ctx, property.title, OG_WIDTH - 96, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, 48, 516 + i * 44));
  ctx.fillStyle = "#cfe6f7";
  ctx.font = `500 30px ${FONT}`;
  const facts = propertyFacts(property);
  if (facts) ctx.fillText(wrapText(ctx, facts, OG_WIDTH - 96, 1)[0], 48, 516 + titleLines.length * 44 + 6);
}

// La imagen de la marca como PNG. `canvasApi`: { createCanvas, Path2D }.
export function brandImagePng({ createCanvas, Path2D }) {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  drawBrandCard(canvas.getContext("2d"), Path2D);
  return canvas.toBuffer("image/png");
}

export function propertyImagePng({ createCanvas, Path2D }, { photo, property }) {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  drawPropertyCard(canvas.getContext("2d"), Path2D, { photo, property });
  return canvas.toBuffer("image/png");
}
