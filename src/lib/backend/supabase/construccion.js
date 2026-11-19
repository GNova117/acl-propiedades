// Backend con Supabase: métodos de «construccion» (17). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import * as construccionSync from "../../construccion/sync";

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
  getConstruccionProyectos: (...args) => construccionSync.getConstruccionProyectos(...args),

  getConstruccionProyecto: (...args) => construccionSync.getConstruccionProyecto(...args),

  addConstruccionProyecto: (...args) => construccionSync.addConstruccionProyecto(...args),

  pushConstruccionProyecto: (...args) => construccionSync.pushConstruccionProyecto(...args),

  deleteConstruccionProyecto: (...args) => construccionSync.deleteConstruccionProyecto(...args),

  getConstruccionCatalogo: (...args) => construccionSync.getConstruccionCatalogo(...args),

  pushConstruccionCatalogo: (...args) => construccionSync.pushConstruccionCatalogo(...args),

  getConstruccionFotos: (...args) => construccionSync.getConstruccionFotos(...args),

  addConstruccionFoto: (...args) => construccionSync.addConstruccionFoto(...args),

  updateConstruccionFotoNota: (...args) => construccionSync.updateConstruccionFotoNota(...args),

  deleteConstruccionFoto: (...args) => construccionSync.deleteConstruccionFoto(...args),

  deleteConstruccionFotosDeHabitacion: (...args) => construccionSync.deleteConstruccionFotosDeHabitacion(...args),

  getConstruccionFondos: (...args) => construccionSync.getConstruccionFondos(...args),

  upsertConstruccionFondo: (...args) => construccionSync.upsertConstruccionFondo(...args),

  updateConstruccionFondo: (...args) => construccionSync.updateConstruccionFondo(...args),

  deleteConstruccionFondo: (...args) => construccionSync.deleteConstruccionFondo(...args),
};
