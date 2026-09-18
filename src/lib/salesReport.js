// Cálculos del apartado "Ventas y reportes" (uso interno). Todo son funciones
// puras sobre datos ya cargados: no se guarda ningún total ni promedio, así el
// reporte siempre refleja el estado actual de Propiedades / Ventas /
// Liquidaciones sin migrar nada cuando cambia una cifra.
//
// Las ganancias NO se calculan aquí con un modelo propio: se reutiliza
// computeLiquidacion() tal cual, con los mismos insumos que usa la pantalla de
// Utilidad de cada propiedad (precio vivo de la propiedad + inversión en
// remodelación viva del proyecto ligado). Así el reporte y la pantalla de
// Utilidad nunca pueden mostrar cifras distintas para la misma casa.

import { computeLiquidacion } from "./liquidacion";
import { computeMaterialsTotals } from "./materialsTotals";

const MS_PER_DAY = 86400000;

// "YYYY-MM-DD" → partes numéricas, sin pasar por Date (evita el corrimiento de
// un día que provoca interpretar una fecha sin hora como UTC).
export function dateParts(isoDate) {
  const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function dateToUtcMs(isoDate) {
  const { year, month, day } = dateParts(isoDate);
  return Date.UTC(year, month, day);
}

export function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

// Una fila por venta registrada, ya enriquecida con la propiedad, el asesor y
// (si el usuario puede ver liquidaciones y esa casa tiene una) su desglose de
// utilidad. `profit` es null cuando no hay liquidación: se muestra como
// "pendiente" y NO se suma como cero, para no aparentar una utilidad nula.
export function buildSaleRows({ ventas, properties, advisors, liquidaciones = [], remodelProjects = [] }) {
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const advisorById = new Map(advisors.map((a) => [a.id, a]));
  const liqByProperty = new Map(liquidaciones.map((l) => [l.property_id, l]));
  const remodelByProperty = new Map(remodelProjects.map((r) => [r.property_id, r]));

  const rows = [];
  for (const venta of ventas) {
    const property = propertyById.get(venta.property_id);
    if (!property) continue;
    const { year, month } = dateParts(venta.fecha_venta);
    const price = Number(property.price) || 0;

    let diasCierre = null;
    if (property.created_at) {
      const days = Math.floor((dateToUtcMs(venta.fecha_venta) - Date.parse(property.created_at)) / MS_PER_DAY);
      // Una venta capturada con fecha anterior a cuando la casa se subió al
      // sistema (casas históricas) no tiene un "tiempo de cierre" medible.
      diasCierre = days >= 0 ? days : null;
    }

    let profit = null;
    const liq = liqByProperty.get(venta.property_id);
    if (liq) {
      const remodel = remodelByProperty.get(venta.property_id);
      const b = computeLiquidacion({
        ...liq,
        precio_propiedad: price,
        inversion_remodelacion: computeMaterialsTotals(remodel?.materials).grandTotalInternal,
      });
      // Quién cobra qué sale de la liquidación (captador / vendedor), no de
      // quién quedó registrado en la venta: es el dinero real de cada asesor.
      const comisiones = [];
      if (liq.captador_id) comisiones.push({ advisorId: liq.captador_id, amount: b.montoCaptador });
      if (!b.mismaPersona && liq.vendedor_id) comisiones.push({ advisorId: liq.vendedor_id, amount: b.comisionVenta });
      profit = {
        utilidadOficina: b.utilidadOficina,
        utilidadNeta: b.utilidadNeta,
        comisiones,
        totalComisiones: comisiones.reduce((sum, c) => sum + c.amount, 0),
        // La liquidación dice que vendió otra persona distinta a la registrada
        // en la venta: no se corrige solo (no sabemos cuál es la buena), se avisa.
        advisorMismatch: Boolean(venta.advisor_id) && (liq.vendedor_id || liq.captador_id) !== venta.advisor_id,
      };
    }

    rows.push({
      id: venta.id,
      propertyId: venta.property_id,
      property,
      advisorId: venta.advisor_id || null,
      advisorName: venta.advisor_id ? advisorById.get(venta.advisor_id)?.name || "—" : null,
      fecha: venta.fecha_venta,
      year,
      month,
      price,
      diasCierre,
      profit,
    });
  }
  return rows.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// period: { year, month (0-11 | null = todo el año), type (clave | "" = todos) }
export function filterRows(rows, { year, month = null, type = "" }) {
  return rows.filter(
    (r) => r.year === year && (month == null || r.month === month) && (!type || r.property.type === type)
  );
}

// Asesores que cuentan como parte del equipo de ventas: activos y visibles en
// el equipo (el asesor "ACL Propiedades" de respaldo no vende, solo diluiría
// el promedio), más cualquiera que sí tenga ventas en el conjunto de filas.
export function salesTeam(advisors, rows) {
  const withSales = new Set(rows.map((r) => r.advisorId).filter(Boolean));
  return advisors.filter((a) => (a.active !== false && a.show_in_team !== false) || withSales.has(a.id));
}

// Casas vendidas por asesor y por mes de un año (matriz de 12 columnas).
export function monthlyMatrix(rows, team, { year, type = "" }) {
  const scoped = filterRows(rows, { year, type });
  const lines = team.map((a) => ({ id: a.id, name: a.name, months: Array(12).fill(0), total: 0 }));
  const byId = new Map(lines.map((l) => [l.id, l]));
  const unassigned = { id: null, name: null, months: Array(12).fill(0), total: 0 };

  for (const r of scoped) {
    const line = (r.advisorId && byId.get(r.advisorId)) || unassigned;
    line.months[r.month] += 1;
    line.total += 1;
  }
  const all = unassigned.total > 0 ? [...lines, unassigned] : lines;
  const totals = Array(12).fill(0);
  for (const line of all) line.months.forEach((n, i) => (totals[i] += n));
  return { lines: all, totals, grandTotal: totals.reduce((a, b) => a + b, 0) };
}

// Meses que cuentan para promediar "ventas por mes": un mes concreto = 1; un
// año pasado = 12; el año en curso = solo los meses ya transcurridos (dividir
// entre 12 en septiembre subestimaría a todos por igual y confundiría).
export function monthsInPeriod({ year, month = null }, now = new Date()) {
  if (month != null) return 1;
  if (year === now.getFullYear()) return now.getMonth() + 1;
  return year > now.getFullYear() ? 1 : 12;
}

function average(values) {
  const valid = values.filter((v) => v != null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

// Medición de desempeño por asesor dentro de un periodo, comparable entre
// ellos y contra el promedio del equipo. La medida principal es ventas por mes
// (normaliza periodos de distinta duración); las demás dan contexto de calidad.
export function advisorPerformance(periodRows, team, period, now = new Date()) {
  const months = monthsInPeriod(period, now);
  const teamSize = Math.max(team.length, 1);
  const teamAvgPerMonth = periodRows.length / months / teamSize;

  // Comisiones cobradas: salen de las liquidaciones de las ventas del periodo,
  // atribuidas a quien la liquidación marca (captador/vendedor), no a quien
  // quedó como "asesor de la venta".
  const earned = new Map();
  for (const r of periodRows) {
    for (const c of r.profit?.comisiones || []) earned.set(c.advisorId, (earned.get(c.advisorId) || 0) + c.amount);
  }

  return team
    .map((a) => {
      const mine = periodRows.filter((r) => r.advisorId === a.id);
      const perMonth = mine.length / months;
      return {
        id: a.id,
        name: a.name,
        sales: mine.length,
        perMonth,
        vsTeam: teamAvgPerMonth > 0 ? perMonth / teamAvgPerMonth - 1 : null,
        volume: mine.reduce((sum, r) => sum + r.price, 0),
        avgTicket: mine.length ? mine.reduce((sum, r) => sum + r.price, 0) / mine.length : null,
        avgDays: average(mine.map((r) => r.diasCierre)),
        commission: earned.has(a.id) ? earned.get(a.id) : null,
      };
    })
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));
}

// Ganancias del conjunto de ventas: solo cuentan las que ya tienen liquidación.
export function profitSummary(periodRows) {
  const withProfit = periodRows.filter((r) => r.profit);
  return {
    sold: periodRows.length,
    liquidated: withProfit.length,
    pending: periodRows.length - withProfit.length,
    volume: periodRows.reduce((sum, r) => sum + r.price, 0),
    utilidadOficina: withProfit.reduce((sum, r) => sum + r.profit.utilidadOficina, 0),
    utilidadNeta: withProfit.reduce((sum, r) => sum + r.profit.utilidadNeta, 0),
    comisiones: withProfit.reduce((sum, r) => sum + r.profit.totalComisiones, 0),
  };
}

// Altas (propiedades subidas al sistema) vs. ventas por mes de un año.
export function inventorySeries(properties, rows, { year, type = "" }) {
  const altas = Array(12).fill(0);
  for (const p of properties) {
    if (type && p.type !== type) continue;
    if (!p.created_at) continue; // sin fecha real de alta no se puede ubicar en un mes
    const created = new Date(p.created_at);
    if (created.getFullYear() === year) altas[created.getMonth()] += 1;
  }
  const ventas = Array(12).fill(0);
  for (const r of filterRows(rows, { year, type })) ventas[r.month] += 1;
  return altas.map((a, i) => ({ month: i, altas: a, ventas: ventas[i] }));
}

// Inventario vigente: lo que sigue sin venderse, con su antigüedad en el
// sistema. `days` es null si la propiedad no tiene fecha de alta real.
export function currentInventory(properties, ventas, { type = "" } = {}, now = new Date()) {
  const soldIds = new Set(ventas.map((v) => v.property_id));
  return properties
    .filter((p) => p.status !== "vendida" && !soldIds.has(p.id) && p.active !== false && (!type || p.type === type))
    .map((p) => ({
      property: p,
      days: p.created_at ? Math.max(0, Math.floor((now.getTime() - Date.parse(p.created_at)) / MS_PER_DAY)) : null,
    }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
}

// Propiedades marcadas "vendida" a las que aún no se les registró quién y
// cuándo vendió (marcarlas desde el formulario de la propiedad no lo pide).
export function pendingSales(properties, ventas) {
  const soldIds = new Set(ventas.map((v) => v.property_id));
  return properties.filter((p) => p.status === "vendida" && !soldIds.has(p.id));
}

// Años con datos (altas o ventas) + el actual, de más reciente a más antiguo.
export function availableYears(properties, ventas, now = new Date()) {
  const years = new Set([now.getFullYear()]);
  for (const v of ventas) years.add(dateParts(v.fecha_venta).year);
  for (const p of properties) if (p.created_at) years.add(new Date(p.created_at).getFullYear());
  return [...years].sort((a, b) => b - a);
}
