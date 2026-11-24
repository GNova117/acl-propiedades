import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { POINTS, rankTeam } from "../lib/leaderboard";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import "./MyDayPanels.css";

const MEDAL = { gold: "🥇", silver: "🥈", bronze: "🥉" };

// «Tabla del mes» (Mi día): posiciones del equipo por puntos (contactos, visitas, prospectos captados y ventas del mes)
// y un reconocimiento para quien cumplió TODAS las metas que se puso. Solo conteos: sin nombres de clientes ni montos,
// y las metas de cada quien no se revelan (solo si las cumplió). `advisorId`: se resalta la fila propia.
export default function TeamLeaderboard({ advisorId }) {
  const { t } = useTranslation();
  const boardQ = useQuery(queries.teamLeaderboard);
  const ranked = useMemo(() => rankTeam(boardQ.data ?? []), [boardQ.data]);
  // Con un solo asesor no hay con quién compararse.
  if (ranked.length < 2) return null;

  return (
    <section className="card day-panel" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">{t("leaderboard.title")}</h2>
      <p className="form-hint">{t("leaderboard.hint", { contacts: POINTS.contacts, visits: POINTS.visits, prospects: POINTS.new_prospects, sales: POINTS.sales })}</p>
      <ol className="leaderboard">
        {ranked.map((row) => (
          <li key={row.advisor_id} className={`leaderboard__row${row.advisor_id === advisorId ? " is-me" : ""}`}>
            <span className="leaderboard__rank" aria-label={t("leaderboard.place", { count: row.rank })}>
              {row.medal ? MEDAL[row.medal] : row.rank}
            </span>
            <span className="leaderboard__name">
              {row.name}
              {row.advisor_id === advisorId && <span className="prospect-chip">{t("leaderboard.you")}</span>}
              {row.allGoalsMet && <span className="prospect-chip prospect-chip--today">🏅 {t("leaderboard.goalsMet")}</span>}
            </span>
            <span className="leaderboard__points">{t("leaderboard.points", { count: row.points })}</span>
            <span className="form-hint leaderboard__detail">
              {t("leaderboard.detail", { contacts: row.contacts, visits: row.visits, prospects: row.new_prospects, sales: row.sales })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
