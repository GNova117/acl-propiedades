// 452: aviso cuando se sube mucho el precio de un material al editarlo. El catálogo guarda solo el precio vigente (no las compras),
// así que se compara contra el precio que tenía antes de esta edición. Una baja o un material sin precio anterior no avisan.
export const PRICE_JUMP_PCT = 15;

const toNumber = (value) => {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// → { pct } (redondeado) si el precio subió más de `threshold` %; null si no.
export function priceJump(previous, next, threshold = PRICE_JUMP_PCT) {
  const before = toNumber(previous);
  const after = toNumber(next);
  if (before == null || after == null || before <= 0) return null;
  const pct = ((after - before) / before) * 100;
  return pct > threshold ? { pct: Math.round(pct) } : null;
}

// Revisa los dos precios del formulario contra los que tenía el material → [{ field, pct, before, after }]
export function materialPriceJumps(previousItem, form, threshold = PRICE_JUMP_PCT) {
  const out = [];
  for (const field of ["unit_price_internal", "unit_price_external"]) {
    const jump = priceJump(previousItem?.[field], form?.[field], threshold);
    if (jump) out.push({ field, pct: jump.pct, before: Number(previousItem[field]), after: Number(form[field]) });
  }
  return out;
}
