// Cuenta, de forma anónima, que alguien guardó una propiedad en favoritos o la compartió: son cifras del
// «Interés en línea» del informe del vendedor (ver track_property_event en schema.sql). Va con el id
// aleatorio del visitante (visitorId.js), una vez por persona, evento y día. Nunca bloquea ni avisa de
// errores: si falla, simplemente no se cuenta.
import { db } from "./dataStore";

export function trackPropertyEvent(kind, propertyId) {
  if (!propertyId || (kind !== "favorite" && kind !== "share")) return;
  try {
    Promise.resolve(db.trackPropertyEvent(propertyId, kind)).catch(() => {});
  } catch {
    /* igual: es solo una cifra */
  }
}
