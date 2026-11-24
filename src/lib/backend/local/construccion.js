// Backend de modo demo (localStorage): métodos de «construccion» (17). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.


export const construccionMethods = {
  async applyConstruccionToProperty() {
    throw new Error("Aplicar datos a una propiedad requiere Supabase conectado (modo demo).");
  },

  // Construcción no tiene paridad en modo demo a propósito (geometría 2D/3D
  // no vale la pena replicar sobre localStorage) — las páginas de ese
  // apartado chequean useAuth().isDemoMode y nunca llegan a llamar esto; estos
  // stubs solo existen para que `db` (unión de supabaseBackend/localBackend)
  // tipe correctamente bajo TypeScript.
  async getConstruccionProyectos() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async getConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async addConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async pushConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async deleteConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async getConstruccionCatalogo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async pushConstruccionCatalogo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async getConstruccionFotos() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async addConstruccionFoto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async updateConstruccionFotoNota() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async deleteConstruccionFoto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async deleteConstruccionFotosDeHabitacion() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async getConstruccionFondos() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async upsertConstruccionFondo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async updateConstruccionFondo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  async deleteConstruccionFondo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
};
