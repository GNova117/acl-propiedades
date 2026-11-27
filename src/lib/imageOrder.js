// Reordenar fotos en el formulario de propiedad. Las fotos ya guardadas y las nuevas son dos listas; el índice de la
// foto principal (`mainIndex`) cuenta las guardadas primero y luego las nuevas.
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Dónde queda, tras mover `from` → `to`, el elemento que antes estaba en `index` (para que la principal siga siendo la misma foto).
export function remapIndex(index, from, to) {
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index >= to && index < from) return index + 1;
  return index;
}

// Mueve una foto dentro de su lista (offset 0 = guardadas, existing.length = nuevas) y devuelve el nuevo mainIndex.
export function moveWithMain(mainIndex, offset, from, to, listLength) {
  if (to < 0 || to >= listLength || from === to) return mainIndex;
  const flatFrom = offset + from;
  const flatTo = offset + to;
  return remapIndex(mainIndex, flatFrom, flatTo);
}
