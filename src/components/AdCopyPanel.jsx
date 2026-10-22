import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { AD_CHANNELS, AD_TONES, MAX_EXTRA_CHARS } from "../lib/adCopy";
import "./AdCopyPanel.css";

// "Redactar con IA" dentro de Publicar en redes: Claude escribe tres versiones
// del anuncio con enfoques distintos para el canal elegido, a partir de los
// datos reales de la propiedad (api/ad-copy.js). El asesor escoge una y la pasa
// al cuadro de texto de arriba (`onUse`) para ajustarla; nada se publica solo.
export default function AdCopyPanel({ property, onUse }) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState("facebook");
  const [tone, setTone] = useState("cercano");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const errorMessage = (err) => {
    const code = err?.code;
    if (code === "limit") return t(err.scope === "team" ? "adCopy.errors.limitTeam" : "adCopy.errors.limitUser", { count: err.limit ?? "?" });
    if (["demo", "no_table", "no_function", "unauthorized", "forbidden", "rate_limited", "refused", "bad_output", "timeout"].includes(code)) return t(`adCopy.errors.${code}`);
    return err?.message || t("adCopy.errors.upstream");
  };

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await db.requestAdCopy({ propertyId: property.id, channel, tone, extra });
      if (res.configured === false) {
        setError(t("adCopy.errors.notConfigured"));
        return;
      }
      setVariants(res.variants || []);
      setCopiedIndex(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
    } catch {
      // Sin portapapeles: el texto sigue a la vista para copiarlo a mano.
    }
  };

  return (
    <section className="ad-copy" aria-label={t("adCopy.title")}>
      <h3>{t("adCopy.title")}</h3>
      <p className="form-hint">{t("adCopy.hint")}</p>

      <div className="ad-copy__controls">
        <div className="form-field">
          <label htmlFor="ad-copy-channel">{t("adCopy.channel")}</label>
          <select id="ad-copy-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {AD_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`adCopy.channels.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ad-copy-tone">{t("adCopy.tone")}</label>
          <select id="ad-copy-tone" value={tone} onChange={(e) => setTone(e.target.value)}>
            {AD_TONES.map((c) => (
              <option key={c} value={c}>
                {t(`adCopy.tones.${c}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="ad-copy-extra">{t("adCopy.extra")}</label>
        <input id="ad-copy-extra" type="text" maxLength={MAX_EXTRA_CHARS} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t("adCopy.extraPlaceholder")} />
      </div>

      <button type="button" className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
        {loading ? <span className="spinner" /> : null}
        {loading ? t("adCopy.writing") : variants.length > 0 ? t("adCopy.again") : t("adCopy.write")}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {variants.length > 0 && (
        <ul className="ad-copy__list">
          {variants.map((v, i) => (
            <li key={i} className="ad-copy__variant">
              {v.angle && <strong className="ad-copy__angle">{v.angle}</strong>}
              <p className="ad-copy__text">{v.text}</p>
              <div className="ad-copy__buttons">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onUse(v.text)}>
                  {t("adCopy.use")}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(v.text, i)}>
                  {copiedIndex === i ? t("socialPost.copied") : t("adCopy.copy")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {variants.length > 0 && <p className="form-hint">{t("adCopy.reviewNote")}</p>}
    </section>
  );
}
