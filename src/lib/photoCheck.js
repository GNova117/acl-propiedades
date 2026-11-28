// 469: revisión rápida de las fotos que se suben a una propiedad, en el navegador: muy oscura, muy quemada o repetida
// (hash perceptual 8×8). Es un aviso, nunca bloquea. Reutiliza el cálculo de brillo de imageQuality.js.
import { computeBrightness } from "./imageQuality";

export const DARK_BELOW = 45;
export const BRIGHT_ABOVE = 225;
export const DUPLICATE_MAX_DISTANCE = 4; // de 64 bits

// imageData de 8×8: un bit por píxel (¿más claro que el promedio?).
export function averageHash(imageData) {
  const { data, width, height } = imageData;
  const lum = [];
  for (let p = 0; p < width * height; p++) lum.push(0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2]);
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  return lum.map((v) => (v >= mean ? "1" : "0")).join("");
}

export function hammingDistance(a, b) {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// analyses: [{ name, brightness, hash }] → avisos [{ name, kind: "dark" | "bright" | "duplicate", of? }]
export function photoWarnings(analyses) {
  const out = [];
  analyses.forEach((a, i) => {
    if (a.brightness != null && a.brightness < DARK_BELOW) out.push({ name: a.name, kind: "dark" });
    else if (a.brightness != null && a.brightness > BRIGHT_ABOVE) out.push({ name: a.name, kind: "bright" });
    for (let j = 0; j < i; j++) {
      if (a.hash && analyses[j].hash && hammingDistance(a.hash, analyses[j].hash) <= DUPLICATE_MAX_DISTANCE) {
        out.push({ name: a.name, kind: "duplicate", of: analyses[j].name });
        break;
      }
    }
  });
  return out;
}

// Lee un archivo de imagen y devuelve { name, brightness, hash }; null si el navegador no puede decodificarlo.
export async function analyzePhoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const draw = (size) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, size, size);
      return ctx.getImageData(0, 0, size, size);
    };
    const result = { name: file.name, brightness: computeBrightness(draw(32)), hash: averageHash(draw(8)) };
    bitmap.close?.();
    return result;
  } catch {
    return null;
  }
}
