import { db } from "./dataStore";

// Las listas que comparten las pantallas del panel (ver dataCache.js): cada una con
// su clave y cómo se pide. Dos pantallas que usan la misma comparten la misma entrada.
// Las que antes se pedían con `.catch(() => [])` siguen así: un fallo no tumba la pantalla.
const orEmpty = (load) => () => load().catch(() => []);

export const queries = {
  advisors: { key: "advisors", fetch: () => db.getAdvisors() },
  properties: { key: "properties", fetch: () => db.getProperties({}) },
  prospects: { key: "prospects", fetch: () => db.getProspects() },
  stageHistory: { key: "prospect-stage-history", fetch: orEmpty(() => db.getProspectStageHistory()) },
  // Las selecciones de propiedades mandadas (de todos o solo las del asesor, según RLS); sin ellas la pantalla sigue igual.
  selections: { key: "selections", fetch: orEmpty(() => db.getSelections()) },
  visits: { key: "visits", fetch: orEmpty(() => db.getVisits()) },
  citas: { key: "agenda-citas", fetch: () => db.getAgendaCitas() },
  // Ausencias de los asesores (las propias, o las de todos para la oficina según RLS); sin ellas las pantallas siguen igual.
  timeOff: { key: "advisor-time-off", fetch: orEmpty(() => db.getAllAdvisorTimeOff()) },
  zones: { key: "zones", fetch: orEmpty(() => db.getZones()) },
  propertyTypes: { key: "property-types", fetch: orEmpty(() => db.getPropertyTypes()) },
  remodelProjects: { key: "remodel-projects", fetch: () => db.getRemodelProjects({}) },
  // `type`: comprador | vendedor | ambos; sin él, todos.
  clients: (type = "") => ({ key: `clients:${type || "all"}`, fetch: () => db.getClients(type ? { type } : {}) }),
};
