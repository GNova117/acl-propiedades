// Backend con Supabase. Antes era un solo archivo de miles de líneas; ahora cada tema vive en su módulo de src/lib/backend/supabase/ y aquí solo se juntan.
// Todos los módulos comparten el mismo objeto (los métodos se llaman entre sí con `this`), así que `db.método()` funciona igual.
import { adminMethods } from "./backend/supabase/admin.js";
import { propertiesMethods } from "./backend/supabase/properties.js";
import { catalogMethods } from "./backend/supabase/catalog.js";
import { contentMethods } from "./backend/supabase/content.js";
import { clientsMethods } from "./backend/supabase/clients.js";
import { documentsMethods } from "./backend/supabase/documents.js";
import { prospectsMethods } from "./backend/supabase/prospects.js";
import { agendaMethods } from "./backend/supabase/agenda.js";
import { salesMethods } from "./backend/supabase/sales.js";
import { operationsMethods } from "./backend/supabase/operations.js";
import { construccionMethods } from "./backend/supabase/construccion.js";

export const supabaseBackend = {
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
