// Pasos del formulario de propiedad (/admin/propiedades/nueva y /admin/naves-industriales/nueva): en vez de una página
// larguísima, cinco pasos cortos con una barra de avance. Guardar está disponible en cualquier paso.
export const STEPS = ["basics", "location", "specs", "publish", "media"];

// A qué paso pertenece cada campo con validación (para llevar a la persona al primer paso con errores).
const FIELD_STEP = {
  title: 0,
  price: 0,
  area_m2: 0,
  zone: 1,
  address: 1,
  lat: 1,
  lng: 1,
};

export const stepOfField = (field) => FIELD_STEP[field] ?? 0;

// Pasos que tienen al menos un error, sin repetir y en orden.
export function stepsWithErrors(errors) {
  return [...new Set(Object.keys(errors || {}).map(stepOfField))].sort((a, b) => a - b);
}

export const firstStepWithErrors = (errors) => stepsWithErrors(errors)[0] ?? null;

export const clampStep = (step, total = STEPS.length) => Math.min(Math.max(Number(step) || 0, 0), total - 1);

// Porcentaje de la barra: el paso 1 de 5 ya cuenta 20 % (la persona ya empezó), el último llega a 100 %.
export const progressPercent = (step, total = STEPS.length) => Math.round(((clampStep(step, total) + 1) / total) * 100);
