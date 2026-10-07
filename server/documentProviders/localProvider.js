import { validateCedulaFiscalPdf, validateActaNacimientoPdf } from "../documentValidation/index.js";

// Proveedor por defecto: regex + QR, sin red externa. Misma forma que
// cualquier adapter de terceros que se agregue después (ver index.js).
export const localProvider = {
  name: "local",
  validateCedulaFiscal: (buffer, opts) => validateCedulaFiscalPdf(buffer, opts),
  validateActaNacimiento: (buffer) => validateActaNacimientoPdf(buffer),
};
