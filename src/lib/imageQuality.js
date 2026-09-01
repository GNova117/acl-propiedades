// Validación de calidad de captura de documentos, 100% en el navegador
// (Canvas 2D, sin dependencias ni servicios externos). Esto valida
// nitidez/exposición/presencia de contenido — NO es OCR ni verificación de
// autenticidad del documento (eso requeriría un servicio pagado tipo AWS
// Textract/Truora/Metamap).

function toGrayscale({ data, width, height }) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

export function computeBrightness(imageData) {
  const gray = toGrayscale(imageData);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length; // 0-255
}

export function computeSharpness(imageData) {
  const { width, height } = imageData;
  const gray = toGrayscale(imageData);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean; // varianza del Laplaciano
}

export function computeEdgeDensity(imageData, threshold = 40) {
  const { width, height } = imageData;
  const gray = toGrayscale(imageData);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  let edgeCount = 0;
  let total = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sx = 0;
      let sy = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++, k++) {
          const v = gray[(y + dy) * width + (x + dx)];
          sx += v * gx[k];
          sy += v * gy[k];
        }
      }
      if (Math.sqrt(sx * sx + sy * sy) >= threshold) edgeCount++;
      total++;
    }
  }
  return edgeCount / total; // proporción 0-1
}

// Puntos de partida para calibrar con fotos reales del entorno de captura
// real (no valores "correctos" de fábrica) — de ahí que se exporten en vez
// de vivir enterrados en evaluateDocumentQuality.
export const QUALITY_THRESHOLDS = {
  minSharpness: 60,
  minBrightness: 60,
  maxBrightness: 200,
  minEdgeDensity: 0.04,
};

export function evaluateDocumentQuality(imageData) {
  const sharpness = computeSharpness(imageData);
  const brightness = computeBrightness(imageData);
  const edgeDensity = computeEdgeDensity(imageData);

  const failReasons = [];
  if (sharpness < QUALITY_THRESHOLDS.minSharpness) failReasons.push("blurry");
  if (brightness < QUALITY_THRESHOLDS.minBrightness) failReasons.push("tooDark");
  if (brightness > QUALITY_THRESHOLDS.maxBrightness) failReasons.push("tooBright");
  if (edgeDensity < QUALITY_THRESHOLDS.minEdgeDensity) failReasons.push("noDocumentDetected");

  return {
    sharpness,
    brightness,
    edgeDensity,
    passed: failReasons.length === 0,
    failReasons,
  };
}
