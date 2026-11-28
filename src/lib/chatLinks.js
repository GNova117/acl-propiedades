// Las respuestas del chat son texto plano; los códigos de propiedad que menciona («ACL-1001») se vuelven enlaces a su ficha.
// → [{ text }, { code }, { text }…]
const CODE = /\bACL-\d{3,8}\b/g;

export function splitChatCodes(text) {
  const parts = [];
  let last = 0;
  const source = String(text ?? "");
  for (const match of source.matchAll(CODE)) {
    if (match.index > last) parts.push({ text: source.slice(last, match.index) });
    parts.push({ code: match[0] });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts;
}
