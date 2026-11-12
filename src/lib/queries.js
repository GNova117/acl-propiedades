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
  visits: { key: "visits", fetch: orEmpty(() => db.getVisits()) },
  citas: { key: "agenda-citas", fetch: () => db.getAgendaCitas() },
  zones: { key: "zones", fetch: orEmpty(() => db.getZones()) },
  remodelProjects: { key: "remodel-projects", fetch: () => db.getRemodelProjects({}) },
  // `type`: comprador | vendedor | ambos; sin él, todos.
  clients: (type = "") => ({ key: `clients:${type || "all"}`, fetch: () => db.getClients(type ? { type } : {}) }),
};
