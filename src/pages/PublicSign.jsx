import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import LanguageToggle from "../components/LanguageToggle";
import SignatureModal from "../components/SignatureModal";
import { db } from "../lib/dataStore";
import { base64ToBytes, dataUrlToBase64 } from "../lib/signing";
import { buildSignedPdf, signedPdfFileName } from "../lib/signedPdf";
import "./PublicSign.css";

// Página pública /firmar/<token>: el cliente abre el enlace privado, pone el
// código que le dio su asesor, lee el PDF y lo firma en pantalla. No hay inicio
// de sesión: lo único que da acceso es el token del enlace + el código.
const CODE_ERRORS = { invalid_code: "signing.public.errInvalidCode", locked: "signing.public.errLocked", expired: "signing.public.errExpired", not_pending: "signing.public.errNotPending", not_found: "signing.public.errNotFound" };

export default function PublicSign() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [info, setInfo] = useState(undefined); // undefined = cargando, null = no existe
  const [code, setCode] = useState("");
  const [opening, setOpening] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [doc, setDoc] = useState(null); // { title, signer_name, document_b64, doc_sha256 }
  const [pdfUrl, setPdfUrl] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [signature, setSignature] = useState(null); // { image (dataURL) }
  const [signing, setSigning] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(null); // { signed_at, ip }
  const [downloading, setDownloading] = useState(false);

  // Página privada: que los buscadores no la indexen.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    db.signingInfo(token)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [token]);

  const blobUrl = useMemo(() => (doc ? URL.createObjectURL(new Blob([base64ToBytes(doc.document_b64)], { type: "application/pdf" })) : ""), [doc]);
  useEffect(() => {
    setPdfUrl(blobUrl);
    return () => blobUrl && URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const handleOpen = async (e) => {
    e.preventDefault();
    setCodeError("");
    setOpening(true);
    try {
      const result = await db.signingOpen(token, code.trim());
      if (result?.error) {
        setCodeError(t(CODE_ERRORS[result.error] || "signing.public.errGeneric"));
        if (result.error !== "invalid_code") setInfo(await db.signingInfo(token));
        return;
      }
      setDoc(result);
      setName(result.signer_name || "");
    } catch {
      setCodeError(t("signing.public.errGeneric"));
    } finally {
      setOpening(false);
    }
  };

  const canSubmit = agree && name.trim().length > 2 && signature && !signing;

  const handleSubmit = async () => {
    setSubmitError("");
    setSigning(true);
    try {
      const result = await db.signingSubmit(token, code.trim(), name.trim(), dataUrlToBase64(signature.image));
      if (result?.error) {
        setSubmitError(t(CODE_ERRORS[result.error] || `signing.public.err_${result.error}`, { defaultValue: t("signing.public.errGeneric") }));
        return;
      }
      setDone(result);
    } catch {
      setSubmitError(t("signing.public.errGeneric"));
    } finally {
      setSigning(false);
    }
  };

  // Copia para el cliente: el PDF original + hoja de firma, armada aquí mismo.
  const downloadCopy = async () => {
    setDownloading(true);
    try {
      const request = {
        document_b64: doc.document_b64,
        title: doc.title,
        doc_sha256: doc.doc_sha256,
        signer_name: doc.signer_name,
        signed_name: name.trim(),
        signed_at: done.signed_at,
        signer_ip: done.ip,
        signer_agent: navigator.userAgent,
        signature_b64: dataUrlToBase64(signature.image),
      };
      const bytes = await buildSignedPdf(request);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = signedPdfFileName(request);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert(t("signing.public.errGeneric"));
    } finally {
      setDownloading(false);
    }
  };

  let body;
  if (info === undefined) {
    body = <p className="form-hint">{t("common.loading")}</p>;
  } else if (info === null) {
    body = <Message title={t("signing.public.notFoundTitle")} text={t("signing.public.notFoundText")} />;
  } else if (done) {
    body = (
      <>
        <h1>{t("signing.public.doneTitle")}</h1>
        <p className="form-hint" style={{ color: "var(--color-success)" }}>
          {t("signing.public.doneText", { title: doc.title })}
        </p>
        <p className="form-hint">
          {new Date(done.signed_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long", timeStyle: "short" })}
        </p>
        <button type="button" className="btn btn-primary" onClick={downloadCopy} disabled={downloading}>
          {downloading ? <span className="spinner" /> : null}
          {t("signing.public.downloadCopy")}
        </button>
      </>
    );
  } else if (!doc) {
    if (info.status === "firmado") body = <Message title={t("signing.public.alreadyTitle")} text={t("signing.public.alreadyText")} />;
    else if (info.status !== "pendiente") body = <Message title={t(`signing.public.unavailable_${info.status}`, { defaultValue: t("signing.public.unavailableTitle") })} text={t("signing.public.unavailableText")} />;
    else {
      body = (
        <>
          <h1>{t("signing.public.title")}</h1>
          <p className="form-hint">{t("signing.public.codeIntro", { title: info.title })}</p>
          <form onSubmit={handleOpen} noValidate>
            <div className="form-field">
              <label htmlFor="sign-code">{t("signing.public.codeLabel")}</label>
              <input
                id="sign-code"
                className="public-sign__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                aria-invalid={Boolean(codeError)}
              />
              {codeError && <span className="form-error">{codeError}</span>}
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={opening || code.length !== 6}>
              {opening ? <span className="spinner" /> : null}
              {t("signing.public.open")}
            </button>
          </form>
        </>
      );
    }
  } else {
    body = (
      <>
        <h1>{doc.title}</h1>
        <p className="form-hint">{t("signing.public.readIntro")}</p>
        <div className="public-sign__viewer">
          <iframe src={pdfUrl} title={doc.title} />
        </div>
        <p className="form-hint">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            {t("signing.public.openPdf")}
          </a>
          {" · "}
          {t("signing.public.hash")}: <code className="public-sign__hash">{doc.doc_sha256.slice(0, 16)}…</code>
        </p>

        <div className="card public-sign__form">
          <label className="access-control__checkbox">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            {t("signing.public.agree")}
          </label>

          <div className="form-field">
            <label htmlFor="sign-name">{t("signing.public.fullName")}</label>
            <input id="sign-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-field">
            <span style={{ fontWeight: 600 }}>{t("signing.public.yourSignature")}</span>
            {signature ? <img className="public-sign__signature" src={signature.image} alt={t("signing.public.yourSignature")} /> : <span className="form-hint">{t("signing.public.noSignature")}</span>}
            <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowPad(true)}>
              {signature ? t("signing.public.signAgain") : t("signing.public.sign")}
            </button>
          </div>

          {submitError && <p className="form-error">{submitError}</p>}
          <button type="button" className="btn btn-primary btn-block" disabled={!canSubmit} onClick={handleSubmit}>
            {signing ? <span className="spinner" /> : null}
            {t("signing.public.submit")}
          </button>
          <p className="form-hint" style={{ marginBottom: 0 }}>
            {t("signing.public.evidenceNote")}
          </p>
        </div>

        {showPad && (
          <SignatureModal
            title={t("signing.public.yourSignature")}
            onCancel={() => setShowPad(false)}
            onAccept={(sig) => {
              setSignature(sig);
              setShowPad(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="public-sign">
      <header className="public-sign__header">
        <Logo variant="white" size="sm" />
        <LanguageToggle />
      </header>
      <main className="public-sign__main">{body}</main>
    </div>
  );
}

function Message({ title, text }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="form-hint">{text}</p>
    </>
  );
}
