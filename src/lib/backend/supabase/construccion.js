// Backend con Supabase: métodos de «construccion» (17). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
// La sincronización de Construcción (planos, geometría) se baja solo cuando alguien entra a esa pantalla del panel: antes entraba en el
// paquete de todo el sitio público.
const loadSync = () => import("../../construccion/sync");

export const construccionMethods = {
  /**
   * Pasa a la propiedad los datos que salen del plano de Construcción (m², recámaras, baños, cajones, altura
   * libre, acabados, techumbre). Solo toca esos campos: no pisa fotos, videos ni nada más de la propiedad.
   */
  async applyConstruccionToProperty(id, patch) {
    const permitidos = ["area_m2", "bedrooms", "bathrooms", "parking", "altura_libre", "acabados", "techumbre"];
    const payload = Object.fromEntries(Object.entries(patch || {}).filter(([k, v]) => permitidos.includes(k) && v !== undefined));
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase.from("properties").update(payload).eq("id", id);
    if (error) throw error;
  },

  // Construcción: mediciones, plano 2D/3D, presupuesto y valuación — apartado
  // nuevo e independiente de Remodelaciones (remodel_projects/materials_catalog),
  // no comparte datos con ese módulo. La lógica de mapeo vive en
  // lib/construccion/sync.ts (portada de app-construccion); aquí solo se
  // delega, para que estas páginas también pasen por `db` como todo lo demás.
  getConstruccionProyectos: async (...args) => (await loadSync()).getConstruccionProyectos(...args),

  getConstruccionProyecto: async (...args) => (await loadSync()).getConstruccionProyecto(...args),

  addConstruccionProyecto: async (...args) => (await loadSync()).addConstruccionProyecto(...args),

  pushConstruccionProyecto: async (...args) => (await loadSync()).pushConstruccionProyecto(...args),

  deleteConstruccionProyecto: async (...args) => (await loadSync()).deleteConstruccionProyecto(...args),

  getConstruccionCatalogo: async (...args) => (await loadSync()).getConstruccionCatalogo(...args),

  pushConstruccionCatalogo: async (...args) => (await loadSync()).pushConstruccionCatalogo(...args),

  getConstruccionFotos: async (...args) => (await loadSync()).getConstruccionFotos(...args),

  addConstruccionFoto: async (...args) => (await loadSync()).addConstruccionFoto(...args),

  updateConstruccionFotoNota: async (...args) => (await loadSync()).updateConstruccionFotoNota(...args),

  deleteConstruccionFoto: async (...args) => (await loadSync()).deleteConstruccionFoto(...args),

  deleteConstruccionFotosDeHabitacion: async (...args) => (await loadSync()).deleteConstruccionFotosDeHabitacion(...args),

  getConstruccionFondos: async (...args) => (await loadSync()).getConstruccionFondos(...args),

  upsertConstruccionFondo: async (...args) => (await loadSync()).upsertConstruccionFondo(...args),

  updateConstruccionFondo: async (...args) => (await loadSync()).updateConstruccionFondo(...args),

  deleteConstruccionFondo: async (...args) => (await loadSync()).deleteConstruccionFondo(...args),
};
