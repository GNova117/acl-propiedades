// Total de la lista de materiales de un proyecto de remodelación (line
// items con cantidad y precio interno/externo). Función pura, compartida
// entre MaterialsTable.jsx (vista del proyecto) y el módulo de Liquidación,
// que toma grandTotalInternal como "Inversión — costo de remodelación".

function lineTotal(row, priceField) {
  const price = row[priceField];
  if (price === "" || price == null) return 0;
  const qty = Number(row.quantity) || 0;
  return qty * Number(price);
}

export function computeMaterialsTotals(materials = []) {
  const grandTotalInternal = materials.reduce((sum, row) => sum + lineTotal(row, "unit_price_internal"), 0);
  const grandTotalExternal = materials.reduce((sum, row) => sum + lineTotal(row, "unit_price_external"), 0);
  return { grandTotalInternal, grandTotalExternal, totalSavings: grandTotalExternal - grandTotalInternal };
}
