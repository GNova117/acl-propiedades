// Aviso al guardar una propiedad con un precio que probablemente es un error de captura (un cero de más o de menos).
// Devuelve la llave del aviso o null. No bloquea: quien guarda confirma y sigue.
export const PRICE_LIMITS = {
  compra: { low: 100000, high: 200000000 },
  renta: { low: 1500, high: 150000 },
};

export function suspiciousPrice(operationType, price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return null;
  const limits = PRICE_LIMITS[operationType === "renta" ? "renta" : "compra"];
  const prefix = operationType === "renta" ? "Rent" : "Sale";
  if (value < limits.low) return `low${prefix}`;
  if (value > limits.high) return `high${prefix}`;
  return null;
}
