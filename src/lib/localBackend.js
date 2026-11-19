// Backend de modo demo (localStorage). Antes era un solo archivo de miles de líneas; ahora cada tema vive en su módulo de src/lib/backend/local/ y aquí solo se juntan.
// Todos los módulos comparten el mismo objeto (los métodos se llaman entre sí con `this`), así que `db.método()` funciona igual.
import { adminMethods } from "./backend/local/admin.js";
import { propertiesMethods } from "./backend/local/properties.js";
import { catalogMethods } from "./backend/local/catalog.js";
import { contentMethods } from "./backend/local/content.js";
import { clientsMethods } from "./backend/local/clients.js";
import { documentsMethods } from "./backend/local/documents.js";
import { prospectsMethods } from "./backend/local/prospects.js";
import { agendaMethods } from "./backend/local/agenda.js";
import { salesMethods } from "./backend/local/sales.js";
import { operationsMethods } from "./backend/local/operations.js";
import { construccionMethods } from "./backend/local/construccion.js";

export const localBackend = {
  ...adminMethods,
  ...propertiesMethods,
  ...catalogMethods,
  ...contentMethods,
  ...clientsMethods,
  ...documentsMethods,
  ...prospectsMethods,
  ...agendaMethods,
  ...salesMethods,
  ...operationsMethods,
  ...construccionMethods,
};
