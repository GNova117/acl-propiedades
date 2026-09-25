import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { daysSince, followUpState, todayISO } from "../lib/prospects";
import "./PendingToday.css";

const KEY_LATE_DAYS = 2; // una llave con 2 días o más fuera se marca como atrasada
const STALE_DAYS = 15; // propiedad disponible sin visitas en este tiempo
const MAX_LINES = 3;

// "Pendientes de hoy" del Panel principal: junta en un solo lugar lo que pide
// atención, mirando solo los apartados que el rol tiene. Todo se calcula con
// datos que ya existen (mensajes, agenda, visitas, Secretaría, prospectos).
export default function PendingToday() {
  const { t } = useTranslation();
  const { hasSection, advisorId } = useAuth();
  const [items, setItems] = useState(null);
  const sectionsKey = ["mensajes", "agenda", "visitas", "secretaria", "prospectos", "propiedades"].map((s) => hasSection(s)).join();

  useEffect(() => {
    let cancelled = false;
    const today = todayISO();
    const settle = (section, load) => (hasSection(section) ? load().catch(() => null) : Promise.resolve(null));

    Promise.all([
      settle("mensajes", () => db.getContactMessages()),
      settle("agenda", () => db.getAgendaCitas()),
      settle("visitas", () => db.getVisits()),
      settle("secretaria", () => db.getSecretariaLog("keys")),
      settle("prospectos", () => db.getProspects()),
      settle("propiedades", () => db.getProperties({})),
    ]).then(([messages, citas, visits, keys, prospects, properties]) => {
      if (cancelled) return;
      const list = [];

      if (messages) {
        const fresh = messages.filter((m) => (m.status || "nuevo") === "nuevo");
        if (fresh.length) list.push({ key: "messages", count: fresh.length, to: "/admin/mensajes", lines: fresh.slice(0, MAX_LINES).map((m) => m.name || m.email) });
      }

      if (citas) {
        const todays = citas.filter((c) => c.fecha === today).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
        if (todays.length) list.push({ key: "agenda", count: todays.length, to: "/admin/agenda", lines: todays.slice(0, MAX_LINES).map((c) => [c.hora, c.titulo].filter(Boolean).join(" · ")) });
      }

      if (visits) {
        const todays = visits.filter((v) => String(v.visited_at).slice(0, 10) === today || daysSince(v.visited_at) === 0);
        if (todays.length) list.push({ key: "visits", count: todays.length, to: "/admin/visitas", tone: "info", lines: [] });
      }

      if (keys) {
        const out = keys.filter((k) => !k.returned_at);
        if (out.length) {
          const late = out.filter((k) => (daysSince(k.logged_at) ?? 0) >= KEY_LATE_DAYS);
          const shown = (late.length ? late : out).slice(0, MAX_LINES);
          list.push({
            key: "keys",
            count: out.length,
            to: "/admin/secretaria",
            tone: late.length ? "warn" : "info",
            note: late.length ? t("pending.keysLate", { count: late.length }) : null,
            lines: shown.map((k) => `${k.key_label} · ${k.receiver_name} (${t("pending.daysOut", { count: daysSince(k.logged_at) ?? 0 })})`),
          });
        }
      }

      if (prospects) {
        const overdue = prospects.filter((p) => followUpState(p) === "overdue");
        const dueToday = prospects.filter((p) => followUpState(p) === "today");
        const due = [...overdue, ...dueToday];
        if (due.length) {
          list.push({ key: "followups", count: due.length, to: "/admin/prospectos", tone: overdue.length ? "warn" : "info", lines: due.slice(0, MAX_LINES).map((p) => p.name) });
        }
        const untouched = prospects.filter((p) => p.stage === "nuevo" && !p.last_contact_at);
        if (untouched.length) list.push({ key: "newProspects", count: untouched.length, to: "/admin/prospectos", lines: untouched.slice(0, MAX_LINES).map((p) => p.name) });
      }

      // Sin visitas en 15 días solo tiene sentido para quien ve las visitas de
      // todos: un asesor ve únicamente las suyas y marcaría de más.
      if (properties && visits && advisorId == null) {
        const lastVisit = new Map();
        for (const v of visits) {
          const prev = lastVisit.get(v.property_id);
          if (!prev || v.visited_at > prev) lastVisit.set(v.property_id, v.visited_at);
        }
        const stale = properties.filter((p) => {
          if (p.status !== "disponible" || p.active === false) return false;
          if ((daysSince(p.created_at) ?? 0) < STALE_DAYS) return false;
          const last = lastVisit.get(p.id);
          return !last || (daysSince(last) ?? 0) >= STALE_DAYS;
        });
        if (stale.length) list.push({ key: "stale", count: stale.length, to: "/admin/visitas", lines: stale.slice(0, MAX_LINES).map((p) => p.title) });
      }

      setItems(list);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsKey]);

  if (items === null || (items.length === 0 && sectionsKey === "false,false,false,false,false,false")) return null;

  return (
    <section className="pending-today" aria-label={t("pending.title")}>
      <h2 className="pending-today__title">{t("pending.title")}</h2>
      {items.length === 0 ? (
        <p className="form-hint">{t("pending.allClear")}</p>
      ) : (
        <div className="pending-today__grid">
          {items.map((item) => (
            <Link key={item.key} to={item.to} className={`card pending-item${item.tone ? ` pending-item--${item.tone}` : ""}`}>
              <span className="pending-item__count">{item.count}</span>
              <span className="pending-item__label">{t(`pending.items.${item.key}`)}</span>
              {item.note && <span className="pending-item__note">{item.note}</span>}
              {item.lines.map((line, i) => (
                <span key={i} className="pending-item__line">
                  {line}
                </span>
              ))}
              {item.count > item.lines.length && item.lines.length > 0 && (
                <span className="pending-item__line">{t("pending.andMore", { count: item.count - item.lines.length })}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
