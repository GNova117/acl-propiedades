// Decodifica el código QR de un PDF (constancia del SAT o acta de
// nacimiento): pdfjs-dist ya no trae su propia implementación de canvas
// desde la v4, así que se le da una mínima con @napi-rs/canvas (binarios
// precompilados — no compila nada en el build de Vercel, a diferencia del
// paquete clásico "canvas"). Si el render o la lectura fallan, se regresa
// sin resultados en vez de lanzar: el documento cae a "requiere revisión"
// más arriba, nunca se bloquea al cliente por esto.
import { createCanvas } from "@napi-rs/canvas";
import jsQR from "jsqr";

class NapiCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

// Suficiente resolución para leer un QR de ~1-2cm impreso a tamaño carta;
// subirla más solo alarga el render sin mejorar la lectura en la práctica.
const RENDER_SCALE = 2.5;

// Revisa hasta `maxPages` páginas (el QR/cadena de verificación de un acta
// a veces queda en la última hoja, no en la primera) y regresa la primera
// coincidencia encontrada.
export async function findQrCodesInPdf(pdfDocument, { maxPages = 3 } = {}) {
  const factory = new NapiCanvasFactory();
  const pageCount = Math.min(pdfDocument.numPages, maxPages);
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDocument.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const { canvas, context } = factory.create(width, height);
    try {
      await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;
      const imageData = context.getImageData(0, 0, width, height);
      const result = jsQR(imageData.data, width, height);
      if (result?.data) return result.data;
    } finally {
      factory.destroy({ canvas, context });
    }
  }
  return null;
}
