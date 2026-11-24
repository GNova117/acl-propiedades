import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { finalTranscript, getRecognitionCtor } from "../lib/dictation";
import "./DictationButton.css";

// Micrófono para dictar una nota (lib/dictation.js). `onText(texto)` recibe cada frase ya definitiva.
// No se muestra si el navegador no trae reconocimiento de voz. Nunca arranca solo: solo al pulsar.
export default function DictationButton({ onText, disabled = false }) {
  const { t, i18n } = useTranslation();
  const Ctor = getRecognitionCtor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => () => recRef.current?.abort?.(), []);

  if (!Ctor) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    setError("");
    const rec = new Ctor();
    rec.lang = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const text = finalTranscript(event);
      if (text) onTextRef.current?.(text);
    };
    rec.onerror = (event) => setError(event?.error === "not-allowed" || event?.error === "service-not-allowed" ? t("dictation.denied") : t("dictation.error"));
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError(t("dictation.error"));
    }
  };

  return (
    <span className="dictation">
      <button
        type="button"
        className={`btn btn-outline btn-sm dictation__btn${listening ? " is-listening" : ""}`}
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        title={t("dictation.privacy")}
      >
        <span aria-hidden="true">{listening ? "⏹" : "🎤"}</span> {listening ? t("dictation.stop") : t("dictation.start")}
      </button>
      {listening && (
        <span className="form-hint" role="status">
          {t("dictation.listening")}
        </span>
      )}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
