import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import VisitSlotPicker from "../components/VisitSlotPicker";
import { db } from "../lib/dataStore";
import { OFFICE_WHATSAPP } from "../lib/office";
import { citaToIcs, downloadIcs, mapsUrl } from "../lib/calendarEvent";
import { MAX_RESCHEDULES } from "../lib/visitSlots";
import { useSlotSelection } from "../lib/useSlotSelection";
import { bookingToCalendarEvent, formatSlotDay, formatSlotTime } from "../lib/visitBookingUi";
import "./PublicVisit.css";

// Página pública /visita/<token>: el cliente que reservó una visita desde la ficha
// confirma que va a asistir, cambia el horario (con un horario libre del mismo
// asesor) o la cancela. Sin login — el token del enlace, que solo recibe quien
// reservó, es lo único que da acceso (igual que /informe/<token>, /firmar/<token>
// y /documentos/<token>; por eso va sin PublicLayout, para que el token no llegue a
// Google Analytics). Las reglas (2 h de aviso, máximo 2 cambios) las aplican las
// funciones reschedule_booking / cancel_booking de supabase/schema.sql; aquí solo se
// muestran. Reprogramar o cancelar le avisa al asesor (contact_message "visita_cambio").

function RescheduleForm({ token, locale, onDone, onClose }) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selection = useSlotSelection(slots || []);

  const loadSlots = useCallback(() => db.getBookingSlots(token).then(setSlots).catch(() => setSlots([])), [token]);
  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const confirm = async () => {
    if (!selection.activeTime) {
      setError(t("scheduleVisit.booking.pickSlot"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await db.rescheduleVisitBooking(token, selection.activeDate, selection.activeTime);
      if (result?.ok) {
        onDone("rescheduled");
        return;
      }
      const code = result?.error;
      if (code === "slot_unavailable") {
        setError(t("visitPage.errors.slotTaken"));
        selection.clearTime();
        loadSlots();
      } else if (code === "too_late" || code === "limit_reached" || code === "not_active") {
        // La visita cambió mientras tanto: se vuelve a leer para mostrar lo vigente.
        onDone("refresh", t(code === "too_late" ? "visitPage.errors.tooLate" : code === "limit_reached" ? "visitPage.errors.limitReached" : "visitPage.errors.notActive"));
      } else {
        setError(t("visitPage.errors.generic"));
      }
    } catch {
      setError(t("visitPage.errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card visit-page__panel" aria-labelledby="visit-page-reschedule">
      <h2 id="visit-page-reschedule">{t("visitPage.reschedule.title")}</h2>
      {slots === null ? (
        <p className="form-hint" role="status">
          {t("scheduleVisit.booking.loading")}
        </p>
      ) : slots.length === 0 ? (
        <p className="form-hint">{t("visitPage.reschedule.noSlots")}</p>
      ) : (
        <>
          <VisitSlotPicker selection={selection} locale={locale} />
          {selection.activeTime && (
            <p className="visit-page__summary" role="status">
              {t("visitPage.reschedule.selected", { when: `${formatSlotDay(selection.activeDate, locale)} · ${formatSlotTime(selection.activeTime, locale)}` })}
            </p>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="visit-page__panel-actions">
        {slots !== null && slots.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {saving ? t("visitPage.reschedule.confirming") : t("visitPage.reschedule.confirm")}
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
          {t("visitPage.back")}
        </button>
      </div>
    </section>
  );
}

function CancelForm({ token, onDone, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await db.cancelVisitBooking(token, reason);
      if (result?.ok) {
        onDone("cancelled");
        return;
      }
      if (result?.error === "too_late" || result?.error === "not_active") {
        onDone("refresh", t(result.error === "too_late" ? "visitPage.errors.tooLateCancel" : "visitPage.errors.notActive"));
      } else {
        setError(t("visitPage.errors.generic"));
      }
    } catch {
      setError(t("visitPage.errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card visit-page__panel" aria-labelledby="visit-page-cancel">
      <h2 id="visit-page-cancel">{t("visitPage.cancel.title")}</h2>
      <p className="form-hint">{t("visitPage.cancel.body")}</p>
      <div className="form-field">
        <label htmlFor="visit-cancel-reason">{t("visitPage.cancel.reasonLabel")}</label>
        <textarea id="visit-cancel-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("visitPage.cancel.reasonPlaceholder")} />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="visit-page__panel-actions">
        <button type="button" className="btn btn-danger" onClick={confirm} disabled={saving}>
          {saving ? <span className="spinner" /> : null}
          {saving ? t("visitPage.cancel.confirming") : t("visitPage.cancel.confirm")}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
          {t("visitPage.cancel.keep")}
        </button>
      </div>
    </section>
  );
}

export default function PublicVisit() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
  const [result, setResult] = useState({ token: null, status: "loading", data: null });
  const state = result.token === token ? result : { status: "loading", data: null };
  const [panel, setPanel] = useState(null); // null | "reschedule" | "cancel"
  const [notice, setNotice] = useState(null); // { tone: "ok" | "error", text }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = `${t("visitPage.pageTitle")} | ACL Propiedades`;
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, [t]);

  const load = useCallback(
    () =>
      db
        .getVisitBooking(token)
        .then((data) => setResult({ token, status: data?.status || "invalido", data }))
        .catch(() => setResult({ token, status: "error", data: null })),
    [token]
  );
  useEffect(() => {
    load();
  }, [load]);

  const data = state.data;
  const property = data?.property;
  const label = property ? (property.code ? `${String(property.title).trim()} (${property.code})` : String(property.title).trim()) : "";
  const when = data?.fecha ? `${formatSlotDay(data.fecha, locale)} · ${formatSlotTime(data.hora, locale)}` : "";

  const confirmAttendance = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await db.confirmVisitAttendance(token);
      setNotice(res?.ok ? { tone: "ok", text: t("visitPage.done.confirmed") } : { tone: "error", text: t(res?.error === "too_late" ? "visitPage.errors.tooLateCancel" : "visitPage.errors.notActive") });
      await load();
    } catch {
      setNotice({ tone: "error", text: t("visitPage.errors.generic") });
    } finally {
      setBusy(false);
    }
  };

  // Al terminar reprogramar/cancelar (o si la visita cambió mientras tanto) se vuelve a leer.
  const handlePanelDone = async (kind, message) => {
    setPanel(null);
    setNotice(kind === "refresh" ? { tone: "error", text: message } : { tone: "ok", text: t(`visitPage.done.${kind}`) });
    await load();
  };

  const addToCalendar = () => {
    const event = bookingToCalendarEvent({ token, fecha: data.fecha, hora: data.hora, duracion_min: data.duracion_min, property }, { titlePrefix: t("scheduleVisit.booking.eventPrefix") });
    downloadIcs(`visita-${data.fecha}.ics`, citaToIcs(event, { advisorName: data.advisor?.name || "" }));
  };

  // El WhatsApp es el de la oficina: el sitio no publica los datos de contacto de cada asesor.
  const whatsappHref = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(t("visitPage.whatsappText", { property: label, when }))}`;

  const status = state.status;
  const isConfirmed = status === "confirmada";
  const isPast = isConfirmed && !data.can_cancel; // la hora ya pasó y aún nadie la cierra
  const changesLeft = data ? Math.max(0, MAX_RESCHEDULES - (data.reschedule_count || 0)) : 0;

  return (
    <div className="visit-page">
      <header className="visit-page__bar">
        <Logo size="sm" />
        <div className="visit-page__tools">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="visit-page__main">
        {status === "loading" && <p className="form-hint">{t("common.loading")}</p>}

        {status === "invalido" && (
          <div className="card visit-page__notice">
            <h1>{t("visitPage.invalidTitle")}</h1>
            <p>{t("visitPage.invalidBody")}</p>
            <a className="btn btn-outline" href={`https://wa.me/${OFFICE_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
              {t("visitPage.whatsappButton")}
            </a>
          </div>
        )}
        {status === "error" && (
          <div className="card visit-page__notice">
            <h1>{t("visitPage.errorTitle")}</h1>
            <p>{t("visitPage.errorBody")}</p>
          </div>
        )}

        {data && !["loading", "invalido", "error"].includes(status) && (
          <>
            <h1>{data.client_name ? t("visitPage.greeting", { name: data.client_name }) : t("visitPage.greetingGeneric")}</h1>

            {notice && (
              <p className={`visit-page__notice-line visit-page__notice-line--${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
                {notice.text}
              </p>
            )}

            <section className="card visit-page__card">
              <p className={`visit-page__status visit-page__status--${status}`}>{t(`visitPage.status.${status}`)}</p>
              <p className={`visit-page__when${status === "cancelada" ? " visit-page__when--cancelled" : ""}`}>{when}</p>
              {Number(data.duracion_min) > 0 && <p className="form-hint">{t("visitPage.duration", { count: Number(data.duracion_min) })}</p>}

              {property && (
                <div className="visit-page__property">
                  {property.main_image && <img src={property.main_image} alt="" loading="lazy" />}
                  <div>
                    <strong>{label}</strong>
                    {property.address && <p className="form-hint">📍 {property.address}</p>}
                    <Link to={`/propiedades/${property.id}`}>{t("visitPage.viewProperty")}</Link>
                  </div>
                </div>
              )}
              {data.advisor?.name && <p className="form-hint">{t("visitPage.withAdvisor", { name: data.advisor.name })}</p>}

              {isConfirmed && !isPast && (
                <div className="visit-page__links">
                  <button type="button" className="btn btn-outline btn-sm" onClick={addToCalendar}>
                    {t("visitPage.addToCalendar")}
                  </button>
                  {property?.address && (
                    <a className="btn btn-outline btn-sm" href={mapsUrl(property.address)} target="_blank" rel="noopener noreferrer">
                      {t("visitPage.directions")}
                    </a>
                  )}
                </div>
              )}
            </section>

            {isConfirmed && !isPast && (
              <section className="card visit-page__card visit-page__actions" aria-label={t("visitPage.actionsLabel")}>
                {data.client_confirmed_at ? (
                  <p className="visit-page__ok">✓ {t("visitPage.attendanceConfirmed")}</p>
                ) : (
                  data.can_confirm && (
                    <button type="button" className="btn btn-primary btn-block" onClick={confirmAttendance} disabled={busy}>
                      {busy ? <span className="spinner" /> : null}
                      {t("visitPage.confirm")}
                    </button>
                  )
                )}

                {panel === null && (
                  <div className="visit-page__buttons">
                    {data.can_reschedule && (
                      <button type="button" className="btn btn-outline" onClick={() => { setNotice(null); setPanel("reschedule"); }}>
                        {t("visitPage.change")}
                      </button>
                    )}
                    {data.can_cancel && (
                      <button type="button" className="btn btn-outline visit-page__cancel" onClick={() => { setNotice(null); setPanel("cancel"); }}>
                        {t("visitPage.cancelVisit")}
                      </button>
                    )}
                  </div>
                )}

                {data.can_reschedule ? (
                  <p className="form-hint">{t("visitPage.changesLeft", { count: changesLeft })}</p>
                ) : (
                  <p className="form-hint">
                    {t("visitPage.cannotChange")}{" "}
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                      {t("visitPage.whatsapp")}
                    </a>
                  </p>
                )}
              </section>
            )}

            {isConfirmed && !isPast && panel === "reschedule" && <RescheduleForm token={token} locale={locale} onDone={handlePanelDone} onClose={() => setPanel(null)} />}
            {isConfirmed && !isPast && panel === "cancel" && <CancelForm token={token} onDone={handlePanelDone} onClose={() => setPanel(null)} />}

            {(isPast || status !== "confirmada") && (
              <section className="card visit-page__card">
                <p>{t(isPast ? "visitPage.pastNote" : `visitPage.statusNote.${status}`)}</p>
                {property && (
                  <Link className="btn btn-primary" to={`/propiedades/${property.id}`}>
                    {t("visitPage.bookAnother")}
                  </Link>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="visit-page__footer">
        <span>ACL Propiedades</span>
      </footer>
    </div>
  );
}
