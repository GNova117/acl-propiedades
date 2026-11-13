// Ausencias del asesor («no estoy del 20 al 27 de noviembre»): los días de descanso de su horario de visitas
// (advisor_time_off, ver visitSlots.js) vistos como lo que son para el equipo. Mientras dura una ausencia no se le ofrecen
// horarios de visita (eso ya lo hacía get_visit_slots), un prospecto nuevo se asigna a otro asesor de la propiedad, la oficina
// lo ve en «Equipo hoy» y él mismo lo ve en Mi día. Funciones puras; las fechas son «YYYY-MM-DD» y los rangos incluyen los
// dos extremos.

export const MAX_REASON = 120;

export const todayISO = (now = new Date()) => now.toLocaleDateString("en-CA");

const covers = (row, date) => Boolean(row?.fecha_inicio && row?.fecha_fin && row.fecha_inicio <= date && date <= row.fecha_fin);

// La ausencia de `advisorId` que cubre `date` (la que termina más tarde si hay varias), o null.
export function absenceFor(rows, advisorId, date = todayISO()) {
  const found = (rows || []).filter((r) => r.advisor_id === advisorId && covers(r, date));
  return found.sort((a, b) => String(b.fecha_fin).localeCompare(String(a.fecha_fin)))[0] || null;
}

// Los asesores que no están en `date`.
export function absentAdvisorIds(rows, date = todayISO()) {
  return new Set((rows || []).filter((r) => covers(r, date)).map((r) => r.advisor_id));
}

// Hasta cuándo sigue ausente: junta ausencias seguidas («20–23» y «24–27» son una sola hasta el 27). Solo si hoy está ausente.
export function absentUntil(rows, advisorId, date = todayISO()) {
  let current = absenceFor(rows, advisorId, date);
  if (!current) return null;
  let end = current.fecha_fin;
  for (let guard = 0; guard < 366; guard += 1) {
    const next = nextDay(end);
    const following = (rows || []).filter((r) => r.advisor_id === advisorId && covers(r, next));
    if (following.length === 0) break;
    current = following.sort((a, b) => String(b.fecha_fin).localeCompare(String(a.fecha_fin)))[0];
    end = current.fecha_fin;
  }
  return end;
}

export function nextDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Las que aún cuentan (hoy o más adelante), por fecha de inicio. Las ya pasadas no se muestran ni se guardan de nuevo.
export function upcomingAbsences(rows, date = todayISO()) {
  return (rows || [])
    .filter((r) => r.fecha_inicio && r.fecha_fin && r.fecha_fin >= date)
    .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)) || String(a.fecha_fin).localeCompare(String(b.fecha_fin)));
}

// Errores de una ausencia al capturarla (claves de i18n); vacío si está bien.
export function validateAbsence({ fecha_inicio: start, fecha_fin: end }, date = todayISO()) {
  if (!start || !end) return { dates: "absences.errors.required" };
  if (end < start) return { dates: "absences.errors.order" };
  if (end < date) return { dates: "absences.errors.past" };
  return {};
}

// Lo que se guarda: fechas completas y en orden, motivo recortado o null, sin duplicados exactos.
export function cleanAbsences(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    if (!r.fecha_inicio || !r.fecha_fin || r.fecha_fin < r.fecha_inicio) continue;
    const motivo = String(r.motivo ?? "").trim().slice(0, MAX_REASON) || null;
    const key = `${r.fecha_inicio}|${r.fecha_fin}|${motivo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin, motivo });
  }
  return out.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
}

// A quién asignarle un prospecto nuevo de una propiedad con varios asesores: el primero que no esté ausente hoy; si todos lo
// están, el primero (el prospecto se queda con alguien y la ausencia se ve en su Mi día). Sin asesores, null.
export function firstPresentAdvisor(advisors, absentIds = new Set()) {
  const list = advisors || [];
  return list.find((a) => !absentIds.has(a.id)) || list[0] || null;
}
