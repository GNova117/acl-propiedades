// 459: al marcar una propiedad como vendida se piden los datos de la venta (fecha y asesor) en el mismo paso. Antes el estatus
// «vendida» se podía poner sin registrar la venta (quedaba como «pendiente» en Reportes) y «días para vender» y los reportes
// dependían de capturarla aparte. Funciones puras.

// ¿Hay que pedir los datos de la venta? Solo al PASAR a «vendida» (no al editar otra cosa de una ya vendida) y si todavía no hay
// una venta registrada para esa propiedad.
export function needsSaleData({ previousStatus, nextStatus, hasSale }) {
  return nextStatus === "vendida" && previousStatus !== "vendida" && !hasSale;
}

// Asesores que se ofrecen: primero los de la propiedad, luego el resto de los activos, sin repetir.
export function advisorOptions(advisors, propertyAdvisorIds = []) {
  const active = (advisors || []).filter((a) => a && a.active !== false);
  const own = propertyAdvisorIds.map((id) => active.find((a) => a.id === id)).filter(Boolean);
  const rest = active.filter((a) => !own.includes(a));
  return [...own, ...rest];
}

// El asesor que se propone: el primero de la propiedad que siga activo (o vacío).
export function defaultAdvisorId(advisors, propertyAdvisorIds = []) {
  return advisorOptions(advisors, propertyAdvisorIds).find((a) => propertyAdvisorIds.includes(a.id))?.id || "";
}

// Valida lo capturado: la fecha es obligatoria, con formato AAAA-MM-DD, y no puede ser futura. → { field: "clave de error" }
export function validateSaleData({ fecha_venta }, today = new Date().toISOString().slice(0, 10)) {
  const errors = {};
  if (!fecha_venta) errors.fecha_venta = "required";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_venta)) errors.fecha_venta = "invalidDate";
  else if (fecha_venta > today) errors.fecha_venta = "futureDate";
  return errors;
}
