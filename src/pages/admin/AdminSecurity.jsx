import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Seo from "../../components/Seo";
import LoadingState from "../../components/LoadingState";
import { useAuth } from "../../context/useAuth.js";
import { db } from "../../lib/dataStore";
import { getDeviceId } from "../../lib/deviceInfo";
import { idleLimitMs } from "../../lib/idleSession";
import { qrCanvas, qrMatrix } from "../../lib/propertyQr";
import { confirmDialog, notify } from "../../lib/toast";

// QR (en el modo demo, o si Supabase no manda su imagen) dibujado con la misma librería que los letreros de propiedades.
function QrFromUri({ uri, label }) {
  const holder = useRef(null);
  useEffect(() => {
    if (!holder.current) return;
    const canvas = qrCanvas(qrMatrix(uri), { scale: 6, logo: false });
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", label);
    canvas.style.maxWidth = "100%";
    holder.current.replaceChildren(canvas);
  }, [uri, label]);
  return <div ref={holder} className="security-qr" />;
}

export default function AdminSecurity() {
  const { t, i18n } = useTranslation();
  const { refreshMfa, isDemoMode } = useAuth();
  const [status, setStatus] = useState(null);
  const [devices, setDevices] = useState(null);
  const [enrollment, setEnrollment] = useState(null); // { factorId, secret, uri, qrSvg }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deviceId = getDeviceId();
  const idleMinutes = Math.round(idleLimitMs(undefined, typeof window === "undefined" ? undefined : window.__ACL_IDLE_LIMIT_MS__) / 60_000);

  const load = useCallback(async () => {
    try {
      setStatus(await db.getMfaStatus());
    } catch {
      setStatus({ enrolled: false, factors: [], error: true });
    }
    try {
      setDevices(await db.listDevices());
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEnroll = async () => {
    setError("");
    setBusy(true);
    try {
      setEnrollment(await db.enrollMfa());
      setCode("");
    } catch (err) {
      setError(err?.message || t("mfa.enrollError"));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await db.verifyMfa(enrollment.factorId, code);
      setEnrollment(null);
      setCode("");
      notify(t("mfa.enabled"));
      await load();
      await refreshMfa();
    } catch {
      setError(t("mfa.badCode"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (factor) => {
    if (!(await confirmDialog(t("mfa.removeConfirm"), { destructive: true }))) return;
    setBusy(true);
    try {
      await db.removeMfa(factor.id);
      notify(t("mfa.removed"));
      await load();
      await refreshMfa();
    } catch (err) {
      notify(err?.message || t("mfa.removeError"));
    } finally {
      setBusy(false);
    }
  };

  const signOutOthers = async () => {
    if (!(await confirmDialog(t("devices.signOutOthersConfirm")))) return;
    setBusy(true);
    try {
      await db.signOutOtherDevices(deviceId);
      notify(t("devices.signedOutOthers"));
      await load();
    } catch (err) {
      notify(err?.message || t("devices.error"));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <LoadingState />;
  const formatDate = (iso) => new Date(iso).toLocaleString(i18n.language);

  return (
    <div className="admin-security">
      <Seo title={t("security.title")} noindex />
      <div className="admin-header">
        <div>
          <h1>{t("security.title")}</h1>
          <p className="form-hint">{t("security.subtitle")}</p>
        </div>
      </div>

      <section className="card admin-security__card" aria-labelledby="sec-mfa">
        <h2 id="sec-mfa">{t("mfa.title")}</h2>
        <p>{t("mfa.intro")}</p>
        {isDemoMode && <p className="form-hint">{t("mfa.demoNote")}</p>}
        {status.error && <p className="form-error" role="alert">{t("mfa.unavailable")}</p>}

        {status.enrolled && !enrollment && (
          <>
            <p role="status"><strong>{t("mfa.active")}</strong></p>
            <ul className="admin-security__list">
              {status.factors.map((factor) => (
                <li key={factor.id}>
                  <span>{factor.name || t("mfa.factorName")} {factor.createdAt && <small>· {formatDate(factor.createdAt)}</small>}</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => remove(factor)} disabled={busy}>
                    {t("mfa.remove")}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!status.enrolled && !enrollment && !status.error && (
          <>
            <p>{t("mfa.inactive")}</p>
            <button type="button" className="btn btn-primary" onClick={startEnroll} disabled={busy}>
              {t("mfa.enable")}
            </button>
          </>
        )}

        {enrollment && (
          <form onSubmit={confirmEnroll} className="admin-security__enroll">
            <ol>
              <li>{t("mfa.step1")}</li>
              <li>
                {t("mfa.step2")}
                <div className="admin-security__qr">
                  {enrollment.qrSvg ? <img src={enrollment.qrSvg} alt={t("mfa.qrAlt")} width="180" height="180" /> : <QrFromUri uri={enrollment.uri} label={t("mfa.qrAlt")} />}
                </div>
                <p className="form-hint">
                  {t("mfa.manualKey")} <code>{enrollment.secret}</code>
                </p>
              </li>
              <li>{t("mfa.step3")}</li>
            </ol>
            <div className="form-field">
              <label htmlFor="mfa-enroll-code">{t("mfa.codeLabel")}</label>
              <input id="mfa-enroll-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="admin-security__actions">
              <button type="submit" className="btn btn-primary" disabled={busy || code.replace(/\s/g, "").length < 6}>{t("mfa.confirm")}</button>
              <button type="button" className="btn btn-outline" onClick={() => { setEnrollment(null); setError(""); }}>{t("common.cancel")}</button>
            </div>
          </form>
        )}
        {!enrollment && error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <section className="card admin-security__card" aria-labelledby="sec-idle">
        <h2 id="sec-idle">{t("idle.sectionTitle")}</h2>
        <p>{idleMinutes > 0 ? t("idle.sectionText", { minutes: idleMinutes }) : t("idle.sectionOff")}</p>
      </section>

      <section className="card admin-security__card" aria-labelledby="sec-devices">
        <h2 id="sec-devices">{t("devices.title")}</h2>
        <p>{t("devices.intro")}</p>
        {devices === null ? (
          <LoadingState />
        ) : devices.length === 0 ? (
          <p className="form-hint">{t("devices.empty")}</p>
        ) : (
          <ul className="admin-security__list">
            {devices.map((device) => (
              <li key={device.device_id}>
                <span>
                  {device.label || t("devices.unknown")} {device.device_id === deviceId && <strong>({t("devices.thisOne")})</strong>}
                  <small> · {t("devices.lastSeen", { when: formatDate(device.last_seen) })}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-outline" onClick={signOutOthers} disabled={busy}>
          {t("devices.signOutOthers")}
        </button>
        <p className="form-hint">{t("devices.limit")}</p>
      </section>
    </div>
  );
}
