// Descripción de una propiedad con PÁRRAFOS y LISTAS: el asesor escribe texto plano y aquí se convierte en bloques que la
// ficha dibuja como <p>, <ul> y <ol>. Reglas: una línea en blanco separa bloques; las líneas que empiezan con «-», «•»,
// «*» o «·» forman una lista con viñetas; las que empiezan con «1.» o «1)» una lista numerada; un salto de línea suelto
// dentro de un párrafo se respeta. Todo sale como TEXTO (nunca HTML): lo escrito no puede inyectar nada.

const BULLET = /^\s*[-•*·]\s+(.*\S)\s*$/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+(.*\S)\s*$/;
const MAX_BLOCKS = 60;

export function descriptionBlocks(text) {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const blocks = [];
  for (const chunk of normalized.split(/\n\s*\n/)) {
    let paragraph = [];
    let list = null; // { type: "ul"|"ol", items: [] }
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ type: "p", lines: paragraph });
      paragraph = [];
    };
    const flushList = () => {
      if (list) blocks.push(list);
      list = null;
    };
    for (const raw of chunk.split("\n")) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      const bullet = BULLET.exec(line);
      const numbered = bullet ? null : NUMBERED.exec(line);
      if (bullet || numbered) {
        const type = bullet ? "ul" : "ol";
        flushParagraph();
        if (list && list.type !== type) flushList();
        if (!list) list = { type, items: [] };
        list.items.push((bullet || numbered)[1]);
      } else {
        flushList();
        paragraph.push(line.trim());
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks.slice(0, MAX_BLOCKS);
}
