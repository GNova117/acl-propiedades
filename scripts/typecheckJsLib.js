// Parte pura de scripts/typecheckJs.mjs (se prueba sin correr tsc).

// «src/lib/a.js(12,5): error TS2339: texto» → { file, line, col, code, message }
export function parseTscErrors(output) {
  const errors = [];
  for (const line of String(output || "").split("\n")) {
    const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line.trim());
    if (match) errors.push({ file: match[1].replace(/\\/g, "/"), line: Number(match[2]), col: Number(match[3]), code: match[4], message: match[5] });
  }
  return errors;
}

// `listed`: archivos que deben estar limpios. → { failing: errores en ellos, candidates: archivos de src/lib sin errores que aún no están en la lista }
export function summarize(errors, listed, allCandidates = []) {
  const set = new Set(listed);
  const dirty = new Set(errors.map((e) => e.file));
  return {
    failing: errors.filter((e) => set.has(e.file)),
    candidates: allCandidates.filter((file) => !set.has(file) && !dirty.has(file)),
  };
}
