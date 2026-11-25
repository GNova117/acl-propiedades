// En qué pantallas salen las partículas de temporada (nieve, confeti…). No salen en el panel ni en los enlaces privados donde la
// persona firma, sube documentos, agenda o llena un registro: ahí distraen de algo serio (una firma legal, un expediente).
const QUIET_SECTIONS = ["/admin", "/informe", "/firmar", "/documentos", "/visita", "/opinion", "/seleccion", "/registro"];

export function showsSeasonalParticles(pathname = "") {
  return !QUIET_SECTIONS.some((section) => pathname === section || pathname.startsWith(`${section}/`));
}
