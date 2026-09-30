// Desglose de gastos de una operación, por municipio y por perfil. Los rubros y
// sus montos NO están en el código: viven en la tabla expense_concepts porque
// cambian por plaza y con el tiempo; aquí solo están la lista de municipios, la
// plantilla de rubros (en cero, para que el equipo capture las cifras reales) y
// el cálculo. Nunca incluye el margen de utilidad de la oficina: si el equipo
// quisiera mostrarlo, tendría que escribirlo como un rubro a propósito.

export const MUNICIPALITIES = ["Gómez Palacio", "Torreón", "Lerdo", "Cuencamé", "Matamoros", "Francisco I. Madero", "San Pedro", "Otro"];

export const PROFILES = ["comprador", "vendedor"];

// kind "percent": % sobre `base` ("price" = precio de venta, "credit" = monto
// del crédito). kind "fixed": monto en pesos.
const t = (profile, name, kind, base = "price") => ({ profile, name, kind, base, value: 0 });

export const TEMPLATE_CONCEPTS = [
  t("comprador", "Carta de libertad de gravamen", "fixed"),
  t("comprador", "Planos / certificado catastral", "fixed"),
  t("comprador", "Impuesto sobre adquisición de inmuebles", "percent"),
  t("comprador", "Escrituras y honorarios notariales", "percent"),
  t("comprador", "Derechos de registro público", "fixed"),
  t("comprador", "Avalúo", "fixed"),
  t("comprador", "Comisión por apertura de crédito", "percent", "credit"),
  t("comprador", "Gastos administrativos del crédito", "fixed"),
  t("vendedor", "Impuesto sobre la renta por enajenación", "percent"),
  t("vendedor", "Cancelación de hipoteca", "fixed"),
  t("vendedor", "Carta de libertad de gravamen", "fixed"),
  t("vendedor", "Constancia de no adeudo de predial", "fixed"),
  t("vendedor", "Constancia de no adeudo de agua", "fixed"),
];

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Monto de un rubro para un precio y un crédito dados.
export function conceptAmount(concept, { price = 0, credit = 0 } = {}) {
  const value = Number(concept.value) || 0;
  if (concept.kind !== "percent") return money(value);
  const base = concept.base === "credit" ? Number(credit) || 0 : Number(price) || 0;
  return money((base * value) / 100);
}

// Desglose de UN municipio y UN perfil: solo los rubros de esa plaza y de ese
// perfil, ya con monto, y el total.
export function computeBreakdown(concepts, { municipality, profile, price, credit }) {
  const rows = concepts
    .filter((c) => c.municipality === municipality && c.profile === profile)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "es"))
    .map((c) => ({ ...c, amount: conceptAmount(c, { price, credit }) }));
  return { rows, total: money(rows.reduce((sum, r) => sum + r.amount, 0)) };
}

export function validateConcept(form) {
  const errors = {};
  if (!form.name?.trim()) errors.name = "required";
  const value = Number(form.value);
  if (!Number.isFinite(value) || value < 0) errors.value = "invalid";
  else if (form.kind === "percent" && value > 100) errors.value = "invalid";
  return errors;
}

export function toConceptFields(form) {
  return {
    municipality: form.municipality,
    profile: form.profile,
    name: form.name.trim(),
    kind: form.kind,
    base: form.kind === "percent" ? form.base : "price",
    value: Number(form.value) || 0,
    sort_order: Number(form.sort_order) || 0,
  };
}
