// Plantillas de temporada del sitio público: en cada fecha importante el
// sitio se decora solo (guirnalda bajo el menú + saludo + una lluvia breve
// de partículas al cargar), sin tocar nada desde el panel ni correr SQL.
//
// Para agregar una fecha nueva basta con sumar un objeto a SEASONS y su
// saludo en `seasons.<id>.greeting` de es.json/en.json. Si dos rangos se
// enciman gana el que aparece primero en la lista.
//
//   range     { from: [mes, día], to: [mes, día] } — inclusive, meses 1-12.
//             Puede cruzar el fin de año (Año Nuevo va del 31/12 al 6/1).
//             O una función (año) => { from, to } para fechas móviles.
//   garland   "papel-picado" | "banderines" | "luces"
//   colors    colores de la guirnalda, se van alternando
//   motifs    (papel picado) recortes: "flor" | "rombos" | "calavera"
//             (banderines) figura opcional dentro de cada banderín: "corazon"
//   pendant   figura que cuelga cada ciertos banderines ("calabaza")
//   particles { shape, motion, colors } — shape: "confeti" | "flor" |
//             "corazon" | "nieve" | "murcielago"; motion: "fall" | "rise" | "fly"
//   icon      figura junto al saludo (mismas formas + "campana", "estrella",
//             "calabaza")
//
// Vista previa sin esperar a la fecha: abrir el sitio con
// ?temporada=<id> (se queda toda la visita), ?temporada=ninguna para
// apagarlas y ?temporada=auto para volver a la fecha real.

function thirdSundayOfJune(year) {
  const firstDow = new Date(year, 5, 1).getDay();
  const firstSunday = 1 + ((7 - firstDow) % 7);
  return firstSunday + 14;
}

export const SEASONS = [
  {
    id: "anio-nuevo",
    range: { from: [12, 31], to: [1, 6] },
    garland: "luces",
    colors: ["#f5c542", "#f3f0e6", "#e0a526", "#fff1a8"],
    particles: { shape: "confeti", motion: "fall", colors: ["#f5c542", "#e0a526", "#c9ccd3", "#fff1a8", "#1565c0"] },
    icon: "estrella",
    iconColor: "#e0a526",
  },
  {
    id: "san-valentin",
    range: { from: [2, 7], to: [2, 14] },
    garland: "banderines",
    colors: ["#d7263d", "#f4a6b8", "#ffffff", "#e8557a"],
    motifs: ["corazon"],
    particles: { shape: "corazon", motion: "rise", colors: ["#d7263d", "#e8557a", "#f4a6b8"] },
    icon: "corazon",
    iconColor: "#d7263d",
  },
  {
    id: "dia-de-las-madres",
    range: { from: [5, 3], to: [5, 10] },
    garland: "banderines",
    colors: ["#f4a6c6", "#c9a7e8", "#ffffff", "#f7c9a8"],
    particles: { shape: "flor", motion: "fall", colors: ["#f4a6c6", "#e77fae", "#c9a7e8", "#fbd3e4"] },
    icon: "flor",
    iconColor: "#e77fae",
  },
  {
    id: "dia-del-padre",
    // Tercer domingo de junio y la semana previa.
    range: (year) => {
      const day = thirdSundayOfJune(year);
      return { from: [6, day - 6], to: [6, day] };
    },
    garland: "banderines",
    colors: ["#0d3b73", "#2f9bdc", "#c9ccd3", "#1565c0"],
    particles: { shape: "confeti", motion: "fall", colors: ["#0d3b73", "#1565c0", "#2f9bdc", "#c9ccd3"] },
    icon: "estrella",
    iconColor: "#1565c0",
  },
  {
    id: "fiestas-patrias",
    // Todo septiembre, el mes patrio.
    range: { from: [9, 1], to: [9, 30] },
    garland: "papel-picado",
    colors: ["#006847", "#ffffff", "#ce1126"],
    motifs: ["flor", "rombos"],
    particles: { shape: "confeti", motion: "fall", colors: ["#006847", "#ce1126", "#e9ecef", "#1f9d6a"] },
    icon: "campana",
    iconColor: "#c9a227",
  },
  {
    id: "halloween",
    range: { from: [10, 15], to: [10, 27] },
    garland: "banderines",
    colors: ["#f07f1a", "#2b2238", "#7b3fa0"],
    pendant: "calabaza",
    particles: { shape: "murcielago", motion: "fly", colors: [] },
    icon: "calabaza",
  },
  {
    id: "dia-de-muertos",
    // Del 28 de octubre (cuando se ponen los altares) al 2 de noviembre.
    range: { from: [10, 28], to: [11, 2] },
    garland: "papel-picado",
    colors: ["#e6007e", "#f39200", "#7b3fa0", "#ffcc00", "#00a19a"],
    motifs: ["calavera", "flor", "rombos"],
    particles: { shape: "flor", motion: "fall", colors: ["#f39200", "#ffb000", "#ff8a00"] },
    icon: "flor",
    iconColor: "#f39200",
  },
  {
    id: "navidad",
    range: { from: [12, 1], to: [12, 30] },
    garland: "luces",
    colors: ["#d7263d", "#1e8e5a", "#f5c542", "#2f9bdc"],
    particles: { shape: "nieve", motion: "fall", colors: ["#9ccbef", "#bfe0f7", "#7fb6e3"] },
    icon: "nieve",
    iconColor: "#2f9bdc",
  },
];

const OVERRIDE_KEY = "acl_temporada";
const OVERRIDE_OFF = "ninguna";

function resolveRange(season, year) {
  return typeof season.range === "function" ? season.range(year) : season.range;
}

export function isSeasonActive(season, date) {
  const { from, to } = resolveRange(season, date.getFullYear());
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  const start = from[0] * 100 + from[1];
  const end = to[0] * 100 + to[1];
  return start <= end ? md >= start && md <= end : md >= start || md <= end;
}

// Lee ?temporada= de la URL con la que se abrió el sitio y lo guarda en
// sessionStorage, para que la vista previa siga al navegar entre páginas
// (la navegación interna no conserva el query string).
function readOverride() {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("temporada");
  try {
    if (param === "auto") {
      sessionStorage.removeItem(OVERRIDE_KEY);
      return null;
    }
    if (param) {
      sessionStorage.setItem(OVERRIDE_KEY, param);
      return param;
    }
    return sessionStorage.getItem(OVERRIDE_KEY);
  } catch {
    return param && param !== "auto" ? param : null;
  }
}

export function getActiveSeason(date = new Date()) {
  const override = readOverride();
  if (override === OVERRIDE_OFF) return null;
  if (override) {
    const forced = SEASONS.find((s) => s.id === override);
    if (forced) return forced;
  }
  return SEASONS.find((s) => isSeasonActive(s, date)) || null;
}

// Año que se festeja en el saludo de Año Nuevo: el 31 de diciembre ya se
// felicita por el año que empieza.
export function greetingYear(date = new Date()) {
  return date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
}
