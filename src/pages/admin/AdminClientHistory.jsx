import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, whatsappDigits } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";
import "./AdminClientHistory.css";

// Línea de tiempo del cliente: junta en un solo lugar lo que hoy está repartido
// en varias pantallas (mensajes, prospecto, visitas, estimaciones, citas y
// documentos). Solo se consultan los apartados que el rol tiene. Mensajes y
// visitas no están ligados al cliente por id, así que se relacionan por
// teléfono (últimos 10 dígitos) o correo.
const last10 = (v) => {
  const d = whatsappDigits(v);
  return d.length >= 10 ? d.slice(-10) : "";
};

const KIND_CLASS = {
  client: "kind-client",
  message: "kind-message",
  prospect: "kind-prospect",
  visit: "kind-visit",
  valuation: "kind-valuation",
  agenda: "kind-agenda",
  document: "kind-document",
  signing: "kind-signing",
};

export default function AdminClientHistory() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const [client, setClient] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [kindFilter, setKindFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    const guarded = (section, load) => (hasSection(section) ? load().catch(() => []) : Promise.resolve([]));

    (async () => {
      const found = await db.getClientById(id);
      if (cancelled) return;
      if (!found) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setClient(found);

      const [properties, docs, valuations, prospects, messages, visits, citas, signings] = await Promise.all([
        db.getProperties({}).catch(() => []),
        guarded("clientes", () => db.getClientDocuments(id)),
        guarded("valuacion", () => db.getValuationEstimates()),
        guarded("prospectos", () => db.getProspects()),
        guarded("mensajes", () => db.getContactMessages()),
        guarded("visitas", () => db.getVisits()),
        guarded("agenda", () => db.getAgendaCitas()),
        guarded("documentos_legales", () => db.getSigningRequests()),
      ]);
      if (cancelled) return;

      const propertyTitle = (pid) => properties.find((p) => p.id === pid)?.title || "";
      const phone = last10(found.phone);
      const email = String(found.email || "").trim().toLowerCase();
      const isMine = (p, e) => (phone && last10(p) === phone) || (email && String(e || "").trim().toLowerCase() === email);

      const list = [];
      list.push({ id: "client", at: found.created_at, kind: "client", title: t("clientHistory.events.client"), detail: "" });

      for (const m of messages.filter((m) => isMine(m.phone, m.email))) {
        list.push({
          id: `m-${m.id}`,
          at: m.created_at,
          kind: "message",
          title: t(`clientHistory.events.message_${m.channel || "formulario"}`, { defaultValue: t("clientHistory.events.message_formulario") }),
          detail: [propertyTitle(m.property_id), String(m.message || "").split("\n")[0]].filter(Boolean).join(" · "),
          to: "/admin/mensajes",
        });
      }

      for (const p of prospects.filter((p) => p.client_id === id || isMine(p.phone, p.email))) {
        list.push({
          id: `p-${p.id}`,
          at: p.created_at,
          kind: "prospect",
          title: t("clientHistory.events.prospect", { stage: t(`prospects.stages.${p.stage}`) }),
          detail: [t(`prospects.sources.${p.source || "manual"}`), propertyTitle(p.property_id), p.looking_for].filter(Boolean).join(" · "),
          to: `/admin/prospectos/${p.id}`,
        });
        if (p.last_contact_at) {
          list.push({ id: `pc-${p.id}`, at: p.last_contact_at, kind: "prospect", title: t("clientHistory.events.contact"), detail: "", to: "/admin/prospectos" });
        }
      }

      for (const v of visits.filter((v) => last10(v.prospect_phone) && last10(v.prospect_phone) === phone)) {
        list.push({
          id: `v-${v.id}`,
          at: v.visited_at,
          kind: "visit",
          title: t("clientHistory.events.visit", { property: propertyTitle(v.property_id) || "—" }),
          detail: t(`visits.interest.${v.interest}`, { defaultValue: v.interest }),
          to: `/admin/visitas/${v.id}`,
        });
      }

      for (const e of valuations.filter((e) => e.client_id === id)) {
        list.push({
          id: `e-${e.id}`,
          at: e.created_at,
          kind: "valuation",
          title: t("clientHistory.events.valuation"),
          detail: `${formatMXN(e.low)} – ${formatMXN(e.high)}${e.zone_name ? ` · ${e.zone_name}` : ""}`,
          to: "/admin/valuacion",
        });
      }

      for (const c of citas.filter((c) => c.client_id === id)) {
        list.push({
          id: `a-${c.id}`,
          at: `${c.fecha}T${c.hora || "00:00"}`,
          kind: "agenda",
          title: t("clientHistory.events.agenda", { title: c.titulo }),
          detail: "",
          to: `/admin/agenda/${c.id}`,
        });
      }

      for (const s of signings.filter((s) => s.client_id === id)) {
        list.push({
          id: `s-${s.id}`,
          at: s.signed_at || s.created_at,
          kind: "signing",
          title: t(s.status === "firmado" ? "clientHistory.events.signed" : "clientHistory.events.signingSent", { title: s.title }),
          detail: s.status === "firmado" ? "" : t(`signing.status.${s.status}`),
          to: "/admin/firmas",
        });
      }

      for (const d of docs) {
        list.push({
          id: `d-${d.id}`,
          at: d.captured_at,
          kind: "document",
          title: t("clientHistory.events.document", { type: t(`documentCapture.docTypes.${d.doc_type}`, { defaultValue: d.doc_type }) }),
          detail: "",
          to: `/admin/clientes/${id}/documentos`,
        });
      }

      list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setEvents(list);
      setLoading(false);
    })().catch(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const kinds = useMemo(() => Array.from(new Set(events.map((e) => e.kind))), [events]);
  const shown = kindFilter ? events.filter((e) => e.kind === kindFilter) : events;

  if (notFound) {
    return (
      <div>
        <p>{t("clientHistory.notFound")}</p>
        <Link to="/admin/clientes" className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("clientHistory.title")}</h1>
          <p className="form-hint">{client?.name}</p>
        </div>
        <div className="admin-header__actions">
          <Link to={`/admin/clientes/${id}`} className="btn btn-outline">
            {t("common.edit")}
          </Link>
          <Link to="/admin/clientes" className="btn btn-outline">
            {t("common.close")}
          </Link>
        </div>
      </div>

      {kinds.length > 1 && (
        <div className="client-history__filters">
          <button type="button" className={`btn btn-sm ${kindFilter === "" ? "btn-primary" : "btn-outline"}`} onClick={() => setKindFilter("")}>
            {t("clientHistory.all")}
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" className={`btn btn-sm ${kindFilter === k ? "btn-primary" : "btn-outline"}`} onClick={() => setKindFilter(k)}>
              {t(`clientHistory.kinds.${k}`)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="form-hint">…</p>
      ) : (
        <ol className="client-history">
          {shown.map((event) => (
            <li key={event.id} className={`client-history__item ${KIND_CLASS[event.kind]}`}>
              <span className="client-history__dot" aria-hidden="true" />
              <div className="client-history__body">
                <span className="client-history__date">
                  {new Date(event.at).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  <span className="client-history__kind">{t(`clientHistory.kinds.${event.kind}`)}</span>
                </span>
                <strong>{event.title}</strong>
                {event.detail && <span className="form-hint">{event.detail}</span>}
                {event.to && (
                  <Link to={event.to} className="client-history__link">
                    {t("clientHistory.open")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="form-hint">{t("clientHistory.note")}</p>
    </div>
  );
}
