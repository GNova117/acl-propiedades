// Dictado por voz con la API de reconocimiento de voz del navegador (Web Speech API).
// Solo funciona donde el navegador la trae (Chrome, Edge, Safari); en los demás no se muestra el botón.
// OJO de privacidad: en Chrome el audio lo transcribe un servicio del proveedor del navegador, no este sitio; por eso
// nunca arranca solo (solo al pulsar el micrófono) y el botón lo avisa.

export function getRecognitionCtor(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return null;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function dictationSupported(win) {
  return getRecognitionCtor(win) != null;
}

// Pega lo dictado al final del texto, con un espacio de por medio y sin pasar de `max` caracteres (0 = sin tope).
export function appendDictation(current, transcript, max = 0) {
  const heard = String(transcript ?? "").replace(/\s+/g, " ").trim();
  if (!heard) return current;
  const base = String(current ?? "");
  const joined = base && !/\s$/.test(base) ? `${base} ${heard}` : `${base}${heard}`;
  return max > 0 ? joined.slice(0, max) : joined;
}

// Junta los resultados definitivos de un evento `result` de SpeechRecognition.
export function finalTranscript(event) {
  const out = [];
  const results = event?.results;
  if (!results) return "";
  for (let i = event.resultIndex ?? 0; i < results.length; i += 1) {
    const result = results[i];
    if (result?.isFinal && result[0]?.transcript) out.push(result[0].transcript);
  }
  return out.join(" ").trim();
}
