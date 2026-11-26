// Minutos de lectura de un texto (200 palabras por minuto, mínimo 1).
export function readingMinutes(text, wordsPerMinute = 200) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
