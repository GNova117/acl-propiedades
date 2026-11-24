import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { HELP_TOPICS, tourSteps } from "../lib/helpTopics";
import "./AdminTour.css";

// Recorrido guiado del panel: una ventana con unos pocos pasos (bienvenida, lo que el rol puede usar y dónde está la
// ayuda). No marca elementos de la pantalla: explica y lleva a cada lugar. `onClose()` al terminar o cerrar.
export default function AdminTour({ onClose }) {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const steps = tourSteps(hasSection);
  const [index, setIndex] = useState(0);
  const boxRef = useRef(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const topic = HELP_TOPICS.find((h) => h.key === step);

  // Foco dentro de la ventana mientras está abierta (Tab no se sale) y Escape la cierra; al cerrar, el foco vuelve a donde estaba.
  useEffect(() => {
    const previous = document.activeElement;
    boxRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !boxRef.current) return;
      const focusable = [...boxRef.current.querySelectorAll("a[href], button:not([disabled])")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const end = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="admin-tour" role="dialog" data-manages-focus aria-modal="true" aria-labelledby="admin-tour-title">
      <div className="admin-tour__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="admin-tour__box card" ref={boxRef} tabIndex={-1}>
        <p className="form-hint">{t("help.tour.progress", { current: index + 1, total: steps.length })}</p>
        <h2 id="admin-tour-title">{t(`help.tour.steps.${step}.title`)}</h2>
        <p>{t(`help.tour.steps.${step}.body`)}</p>
        {topic?.to && (
          <Link to={topic.to} className="btn btn-outline btn-sm" onClick={onClose}>
            {t("help.tour.goThere")}
          </Link>
        )}
        <div className="admin-tour__actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("help.tour.skip")}
          </button>
          <span className="admin-tour__spacer" />
          {index > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setIndex(index - 1)}>
              {t("help.tour.back")}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? t("help.tour.finish") : t("help.tour.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
