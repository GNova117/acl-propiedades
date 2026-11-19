// @ts-check
// «Reportar un problema»: lo que una persona del equipo escribe cuando nota algo que no sale bien. Se guarda junto a los errores
// automáticos (client_errors) pero con origen «usuario» y su correo como etiqueta (el correo lo pone la base desde la sesión).
import { sanitizeUrl } from "./errorReporter.js";

export const PROBLEM_MIN_LENGTH = 10;
export const PROBLEM_MAX_LENGTH = 1000;

/** @param {string} text → null si está bien, o "empty" | "short" */
export function validateProblem(text) {
  const clean = String(text || "").trim();
  if (clean.length === 0) return "empty";
  if (clean.length < PROBLEM_MIN_LENGTH) return "short";
  return null;
}

/**
 * Lo que se manda: el texto, la pantalla donde estaba (sin parámetros ni enlaces secretos), el navegador y la versión.
 * @param {{ message: string, pathname: string, userAgent?: string, release?: string }} input
 */
export function buildProblemPayload({ message, pathname, userAgent = "", release = "" }) {
  return {
    message: String(message || "").trim().slice(0, PROBLEM_MAX_LENGTH),
    url: sanitizeUrl(pathname),
    userAgent: String(userAgent).slice(0, 300),
    release: String(release).slice(0, 40),
  };
}
