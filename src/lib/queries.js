import { db } from "./dataStore";

// Las listas que comparten las pantallas del panel (ver dataCache.js): cada una con
// su clave y cómo se pide. Dos pantallas que usan la misma comparten la misma entrada.
// Las que antes se pedían con `.catch(() => [])` siguen así: un fallo no tumba la pantalla.
const orEmpty = (load) => () => load().catch(() => []);

export const queries = {
  advisors: { key: "advisors", fetch: () => db.getAdvisors() },
  properties: { key: "properties", fetch: () => db.getProperties({}) },
  prospects: { key: "prospects", fetch: () => db.getProspects() },
  // Cuántos contactos lleva cada prospecto (para la secuencia de seguimiento sugerida).
  contactLog: { key: "prospect-contact-log", fetch: orEmpty(() => db.getProspectContactLog()) },
  stageHistory: { key: "prospect-stage-history", fetch: orEmpty(() => db.getProspectStageHistory()) },
  // Las selecciones de propiedades mandadas (de todos o solo las del asesor, según RLS); sin ellas la pantalla sigue igual.
  selections: { key: "selections", fetch: orEmpty(() => db.getSelections()) },
  visits: { key: "visits", fetch: orEmpty(() => db.getVisits()) },
  // Opiniones que dejaron los clientes tras su visita (encuesta de /opinion/<token>).
  visitFeedback: { key: "visit-feedback", fetch: orEmpty(() => db.getVisitFeedback()) },
  citas: { key: "agenda-citas", fetch: () => db.getAgendaCitas() },
  // Contratos de intermediación con su vencimiento y comisiones por asesor (RLS decide qué ve cada quien).
  propertyContracts: { key: "property-contracts", fetch: orEmpty(() => db.getPropertyContracts()) },
  teamLeaderboard: { key: "team-leaderboard", fetch: orEmpty(() => db.getTeamLeaderboard()) },
  commissions: { key: "commissions", fetch: orEmpty(() => db.getCommissions()) },
  zones: { key: "zones", fetch: orEmpty(() => db.getZones()) },
  propertyTypes: { key: "property-types", fetch: orEmpty(() => db.getPropertyTypes()) },
  remodelProjects: { key: "remodel-projects", fetch: () => db.getRemodelProjects({}) },
  // `type`: comprador | vendedor | ambos; sin él, todos.
  clients: (type = "") => ({ key: `clients:${type || "all"}`, fetch: () => db.getClients(type ? { type } : {}) }),
};
