// Una sola función de Vercel para las dos respuestas "de archivo" del sitio:
//   /api/og?id=…       → imagen para compartir una propiedad (server/vercelOg.js)
//   /api/agenda-ics?t… → calendario suscribible de la Agenda  (server/vercelAgendaIcs.js)
//   /api/plantilla     → hoja membretada para los PDF, solo con sesión y rol con acceso (server/vercelLetterhead.js)
// vercel.json las reescribe aquí con `kind=og` / `kind=ics`, así las direcciones públicas no cambian. Van juntas porque
// el plan Hobby de Vercel permite 12 funciones POR DESPLIEGUE y el middleware de vista previa cuenta como una más: con
// una función por cada dirección el despliegue se pasaba del límite.
import ogHandler from "../server/vercelOg.js";
import agendaIcsHandler from "../server/vercelAgendaIcs.js";
import letterheadHandler from "../server/vercelLetterhead.js";

export default async function handler(req, res) {
  const kind = req.query?.kind;
  if (kind === "og") return ogHandler(req, res);
  if (kind === "ics") return agendaIcsHandler(req, res);
  if (kind === "plantilla") return letterheadHandler(req, res);
  res.status(404).send("Not found");
  return undefined;
}
