// PDF de la estimación de valor sobre la hoja membretada de ACL, con un mapa
// satelital de las figuras medidas (terreno y construcción). El mapa se arma
// aquí mismo: se descargan los mosaicos de Esri que cubren las figuras, se
// pegan en un canvas y se dibujan encima los polígonos. Si el navegador no
// puede leer los mosaicos (sin red, CORS), el PDF sale igual sin mapa.

const TEMPLATE_URL = "/plantilla_acl.pdf";
const MARGIN_LEFT = 60;
const CONTENT_WIDTH = 612 - 60 * 2;
const TOP_Y = 628;
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const TILE = 256;
const MAP_W = 1140;
const MAP_H = 560;
const MAX_ZOOM = 19;
const SHAPE_COLORS = { land: "#1e8e5a", built: "#1565c0" };

const SMART_CHARS = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };
const sanitize = (text) =>
  String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of sanitize(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const mxn = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const area = (v) => `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(Number(v) || 0)} m²`;

// Coordenadas de "mundo" (píxeles a zoom z) de Web Mercator.
const worldX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
const worldY = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};

function loadTile(z, x, y) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${TILE_URL}/${z}/${y}/${x}`;
  });
}

// Devuelve los bytes JPEG del mapa o null si no se pudo armar.
export async function renderMapJpeg(shapes) {
  const pts = shapes.flatMap((s) => s.points);
  if (pts.length < 3) return null;
  try {
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    // Mayor zoom en el que las figuras caben con ~15 % de aire alrededor.
    let z = MAX_ZOOM;
    while (z > 1) {
      const w = worldX(maxLng, z) - worldX(minLng, z);
      const h = worldY(minLat, z) - worldY(maxLat, z);
      if (w <= MAP_W * 0.7 && h <= MAP_H * 0.7) break;
      z--;
    }

    const cx = (worldX(minLng, z) + worldX(maxLng, z)) / 2;
    const cy = (worldY(minLat, z) + worldY(maxLat, z)) / 2;
    const left = cx - MAP_W / 2;
    const top = cy - MAP_H / 2;

    const canvas = document.createElement("canvas");
    canvas.width = MAP_W;
    canvas.height = MAP_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    const n = 2 ** z;
    const jobs = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + MAP_W) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + MAP_H) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wrapped = ((tx % n) + n) % n;
        jobs.push(
          loadTile(z, wrapped, ty).then((img) => {
            if (img) ctx.drawImage(img, tx * TILE - left, ty * TILE - top);
            return Boolean(img);
          })
        );
      }
    }
    const drawn = (await Promise.all(jobs)).filter(Boolean).length;
    if (drawn === 0) return null;

    for (const kind of ["land", "built"]) {
      for (const shape of shapes.filter((s) => s.kind === kind)) {
        ctx.beginPath();
        shape.points.forEach(([lat, lng], i) => {
          const px = worldX(lng, z) - left;
          const py = worldY(lat, z) - top;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = `${SHAPE_COLORS[kind]}55`;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = SHAPE_COLORS[kind];
        ctx.stroke();
      }
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch (err) {
    // Canvas "tainted" por CORS u otro fallo: se omite el mapa.
    console.warn("Mapa del PDF no disponible", err);
    return null;
  }
}

// `data`: { zoneName, landArea, builtArea, landRate, builtRate, spreadPct,
// result (estimateValue), shapes, reference? }, `labels`: textos ya traducidos.
export async function buildValuationPdf(data, labels, { template } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const templateBytes =
    template ??
    (await fetch(TEMPLATE_URL).then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar la plantilla membretada");
      return res.arrayBuffer();
    }));

  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  let y = TOP_Y;

  const text = (value, { x = MARGIN_LEFT, size = 10, font = regular, color = black } = {}) =>
    page.drawText(sanitize(value), { x, y, size, font, color });
  const right = (value, { size = 10, font = regular } = {}) => {
    const v = sanitize(value);
    page.drawText(v, { x: MARGIN_LEFT + CONTENT_WIDTH - font.widthOfTextAtSize(v, size), y, size, font, color: black });
  };

  const title = sanitize(labels.title).toUpperCase();
  text(title, { size: 14, font: bold });
  const tw = bold.widthOfTextAtSize(title, 14);
  page.drawLine({ start: { x: MARGIN_LEFT, y: y - 3 }, end: { x: MARGIN_LEFT + tw, y: y - 3 }, thickness: 1, color: black });
  y -= 24;

  text(`${labels.date}: ${new Date(data.date || Date.now()).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}`, { color: gray });
  y -= 15;
  if (data.zoneName) {
    text(`${labels.zone}: `, { font: bold });
    text(data.zoneName, { x: MARGIN_LEFT + bold.widthOfTextAtSize(`${sanitize(labels.zone)}: `, 10) });
    y -= 15;
  }
  if (data.reference) {
    text(`${labels.reference}: `, { font: bold });
    text(data.reference, { x: MARGIN_LEFT + bold.widthOfTextAtSize(`${sanitize(labels.reference)}: `, 10) });
    y -= 15;
  }
  y -= 8;

  // Rango estimado destacado.
  text(labels.range, { size: 11, font: bold });
  y -= 22;
  text(`${mxn(data.result.low)} - ${mxn(data.result.high)}`, { size: 20, font: bold });
  y -= 18;
  text(`${labels.center}: ${mxn(data.result.center)}   (± ${Number(data.spreadPct) || 0} %)`, { color: gray });
  y -= 24;

  // Desglose.
  text(labels.breakdown, { size: 11, font: bold });
  y -= 6;
  page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y }, thickness: 0.5, color: gray });
  y -= 14;
  const rows = [
    data.landArea > 0 && [`${labels.landRate}: ${area(data.landArea)} x ${mxn(data.landRate)} / m²`, data.result.landValue],
    data.builtArea > 0 && [`${labels.builtRate}: ${area(data.builtArea)} x ${mxn(data.builtRate)} / m²`, data.result.builtValue],
  ].filter(Boolean);
  for (const [label, value] of rows) {
    text(label);
    right(mxn(value));
    y -= 15;
  }
  y -= 10;

  // Mapa con las figuras.
  const jpg = await renderMapJpeg(data.shapes || []);
  if (jpg) {
    const img = await doc.embedJpg(jpg);
    const w = CONTENT_WIDTH;
    const h = (w * MAP_H) / MAP_W;
    text(labels.map, { size: 11, font: bold });
    y -= 8;
    page.drawImage(img, { x: MARGIN_LEFT, y: y - h, width: w, height: h });
    page.drawRectangle({ x: MARGIN_LEFT, y: y - h, width: w, height: h, borderColor: gray, borderWidth: 0.5 });
    y -= h + 12;
    // Leyenda.
    let lx = MARGIN_LEFT;
    for (const kind of ["land", "built"]) {
      if (!(data.shapes || []).some((s) => s.kind === kind)) continue;
      const hex = SHAPE_COLORS[kind];
      page.drawRectangle({
        x: lx, y: y - 1, width: 9, height: 9,
        color: rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255),
      });
      const name = labels[kind === "land" ? "landRate" : "builtRate"];
      text(name, { x: lx + 14, size: 9 });
      lx += 14 + regular.widthOfTextAtSize(sanitize(name), 9) + 20;
    }
    y -= 8;
    text(labels.mapAttribution, { size: 7, color: gray });
    y -= 14;
  }

  for (const line of wrap(labels.disclaimer, regular, 8, CONTENT_WIDTH)) {
    text(line, { size: 8, color: gray });
    y -= 11;
  }

  return doc.save();
}

const fileSafe = (text) =>
  sanitize(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export async function downloadValuationPdf(data, labels, options) {
  const bytes = await buildValuationPdf(data, labels, options);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `EstimacionValor_${fileSafe(data.zoneName) || "Zona"}_${stamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
