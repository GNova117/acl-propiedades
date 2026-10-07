// Orquesta la validación automática de un PDF subido por el portal de
// clientes: texto + QR + heurística de estado. Es SOLO una sugerencia —
// nunca marca "rechazado" por sí sola (eso lo decide siempre una persona en
// /admin/clientes/:id/documentos) y nunca lanza por no encontrar un campo:
// lo que no se pudo leer se reporta en `camposFaltantes` y el estado cae a
// "requiere_revision", nunca bloquea al cliente.
import { loadPdf, extractPdfText } from "./pdfText.js";
import { findQrCodesInPdf } from "./qrDecode.js";
import { extractCedulaFiscalFields, SAT_QR_HOST_PATTERN } from "./extractCedulaFiscal.js";
import { extractActaNacimientoFields } from "./extractActaNacimiento.js";
import { hasSuspiciousPdfObjects } from "./fileSignature.js";

export class DocumentValidationError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

async function readQr(pdfDocument) {
  try {
    return await findQrCodesInPdf(pdfDocument);
  } catch (err) {
    // Un fallo al renderizar/leer el QR no debe tumbar la subida completa.
    console.error("qr_decode_failed", err?.message);
    return null;
  }
}

export async function validateCedulaFiscalPdf(buffer, { maxAgeMonths = 3 } = {}) {
  if (hasSuspiciousPdfObjects(buffer)) {
    throw new DocumentValidationError("suspicious_pdf", "El PDF contiene elementos no permitidos.");
  }
  const pdfDocument = await loadPdf(buffer);
  const text = await extractPdfText(pdfDocument);
  const fields = extractCedulaFiscalFields(text);
  const qrRaw = await readQr(pdfDocument);
  const qrValidated = qrRaw ? SAT_QR_HOST_PATTERN.test(qrRaw) : null;

  const camposFaltantes = ["rfc", "nombre", "regimen", "domicilioFiscal", "fechaEmision"].filter((key) => !fields[key]);

  let alertaVigencia = false;
  if (fields.fechaEmision) {
    const months = (Date.now() - new Date(`${fields.fechaEmision}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30);
    alertaVigencia = months > maxAgeMonths;
  }

  const suggestedStatus = camposFaltantes.length === 0 && qrValidated !== false && !alertaVigencia ? "valido" : "requiere_revision";

  return {
    extractedData: { ...fields, camposFaltantes, alertaVigencia },
    qrValidated,
    suggestedStatus,
  };
}

export async function validateActaNacimientoPdf(buffer) {
  if (hasSuspiciousPdfObjects(buffer)) {
    throw new DocumentValidationError("suspicious_pdf", "El PDF contiene elementos no permitidos.");
  }
  const pdfDocument = await loadPdf(buffer);
  const text = await extractPdfText(pdfDocument, { maxPages: 2 });
  const fields = extractActaNacimientoFields(text);
  const qrRaw = await readQr(pdfDocument);
  // No hay un dominio único (son 32 registros civiles estatales distintos
  // vía RENAPO): solo se registra si se pudo leer algo, no si es "correcto".
  const qrValidated = qrRaw ? true : null;

  const camposFaltantes = ["curp", "nombre", "fechaNacimiento"].filter((key) => !fields[key]);
  const suggestedStatus = camposFaltantes.length === 0 ? "valido" : "requiere_revision";

  return {
    extractedData: { ...fields, camposFaltantes },
    qrValidated,
    suggestedStatus,
  };
}
