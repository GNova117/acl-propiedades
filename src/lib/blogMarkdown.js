// Cuerpo de un artículo del blog → bloques. Admite lo básico, sin HTML crudo (se pinta con elementos de React, así que nada se ejecuta):
//   ## Subtítulo      ### Subtítulo menor      - elemento / * elemento (lista)      1. elemento (lista numerada)
//   [texto](https://… o /ruta)      ![descripción](https://…)      **negritas**
// Los párrafos se separan con una línea en blanco, como siempre. Un artículo escrito solo con párrafos se ve igual que antes.

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i;

// Texto en línea → [{ type: "text" | "link" | "bold", ... }]
export function parseInline(text) {
  const out = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push({ type: "text", text: text.slice(last, match.index) });
    if (match[1] !== undefined) {
      // Un enlace con dirección no permitida (javascript:, data:…) queda como texto plano.
      if (SAFE_URL.test(match[2])) out.push({ type: "link", text: match[1], href: match[2], external: /^https?:\/\//i.test(match[2]) });
      else out.push({ type: "text", text: match[1] });
    } else {
      out.push({ type: "bold", text: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseBlogBody(body) {
  const blocks = [];
  for (const chunk of String(body || "").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    const first = lines[0].trim();
    const heading = first.match(/^(#{2,3})\s+(.+)$/);
    const image = first.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/);

    if (heading && lines.length === 1) {
      blocks.push({ type: "heading", level: heading[1].length, inline: parseInline(heading[2]) });
    } else if (image && lines.length === 1) {
      blocks.push({ type: "image", alt: image[1], src: image[2] });
    } else if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      blocks.push({ type: "list", ordered: false, items: lines.map((line) => parseInline(line.replace(/^\s*[-*]\s+/, ""))) });
    } else if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      blocks.push({ type: "list", ordered: true, items: lines.map((line) => parseInline(line.replace(/^\s*\d+[.)]\s+/, ""))) });
    } else {
      // Párrafo: los saltos de línea simples se conservan como están (antes se mostraban pegados).
      blocks.push({ type: "paragraph", inline: parseInline(lines.join(" ")) });
    }
  }
  return blocks;
}
