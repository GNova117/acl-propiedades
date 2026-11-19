// Tabla de posiciones del equipo en el mes. Los conteos salen de team_leaderboard() (schema.sql) o, en modo demo, de
// computeLeaderboardRows (su espejo). Aquí se ordenan y se reparten los reconocimientos. Funciones puras.
//
// Puntos (se muestran tal cual en pantalla, para que nadie dude de cómo se calculó):
export const POINTS = { contacts: 1, visits: 3, new_prospects: 2, sales: 20 };

const dayStart = (now) => new Date(now.getFullYear(), now.getMonth(), 1);
const inMonthFrom = (value, start) => {
  if (!value) return false;
  const text = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
  return !Number.isNaN(date.getTime()) && date >= start;
};

// Espejo de team_leaderboard(): solo asesores activos; contactos por el asesor DEL PROSPECTO; metas solo contadas.
export function computeLeaderboardRows({ advisors = [], prospects = [], contacts = [], visits = [], ventas = [], goals = {} }, now = new Date()) {
  const start = dayStart(now);
  const advisorOfProspect = new Map(prospects.map((p) => [p.id, p.advisor_id]));
  return advisors
    .filter((a) => a.active !== false)
    .map((a) => {
      const row = {
        advisor_id: a.id,
        name: a.name,
        contacts: contacts.filter((c) => advisorOfProspect.get(c.prospecto_id) === a.id && inMonthFrom(c.at, start)).length,
        visits: visits.filter((v) => v.advisor_id === a.id && inMonthFrom(v.visited_at, start)).length,
        new_prospects: prospects.filter((p) => p.advisor_id === a.id && inMonthFrom(p.created_at, start)).length,
        sales: ventas.filter((v) => v.advisor_id === a.id && inMonthFrom(v.fecha_venta, start)).length,
      };
      const g = goals[a.id] || {};
      const keys = ["contacts", "visits", "new_prospects", "sales"];
      row.goals_set = keys.filter((k) => Number(g[k]) > 0).length;
      row.goals_met = keys.filter((k) => Number(g[k]) > 0 && row[k] >= Number(g[k])).length;
      return row;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export const pointsOf = (row) => Object.entries(POINTS).reduce((sum, [key, weight]) => sum + (Number(row[key]) || 0) * weight, 0);

// → filas con { ...row, points, rank, medal, allGoalsMet }. Ordena por puntos y desempata por ventas, visitas y nombre;
// quien empata en puntos comparte lugar. La medalla (oro, plata, bronce) solo se da a quien tiene puntos.
export function rankTeam(rows) {
  const scored = rows
    .map((row) => ({ ...row, points: pointsOf(row), allGoalsMet: Number(row.goals_set) > 0 && Number(row.goals_met) === Number(row.goals_set) }))
    .sort((a, b) => b.points - a.points || b.sales - a.sales || b.visits - a.visits || String(a.name).localeCompare(String(b.name)));
  let rank = 0;
  return scored.map((row, i) => {
    if (i === 0 || row.points !== scored[i - 1].points) rank = i + 1;
    return { ...row, rank, medal: row.points > 0 && rank <= 3 ? ["gold", "silver", "bronze"][rank - 1] : null };
  });
}
