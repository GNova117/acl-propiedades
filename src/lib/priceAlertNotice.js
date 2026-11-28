// 458: al bajar el precio de una propiedad, las personas que pidieron «avísame si baja de precio» reciben un mensaje (lo manda una
// función del servidor cada hora). Para que no sea una sorpresa, el formulario avisa a cuántas les va a llegar y pide confirmar.
// Funciones puras.

// `alerts`: las alertas del sitio ({ kind, property_id, active }). → { drop, count }
//   drop  = el precio nuevo es menor que el anterior;
//   count = alertas de baja de precio activas de esa propiedad (solo cuenta si hubo baja).
export function priceAlertNotice({ oldPrice, newPrice, alerts, propertyId }) {
  const before = Number(oldPrice);
  const after = Number(newPrice);
  const drop = Number.isFinite(before) && Number.isFinite(after) && before > 0 && after > 0 && after < before;
  if (!drop) return { drop: false, count: 0 };
  const count = (alerts || []).filter((a) => a && a.active !== false && a.kind === "price" && a.property_id === propertyId).length;
  return { drop: true, count };
}
