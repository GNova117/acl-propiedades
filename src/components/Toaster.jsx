import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { dismiss, getConfirmRequest, getToasts, resolveConfirm, subscribe } from "../lib/toast";
import "./Toaster.css";

function ToastItem({ toast }) {
  const { t } = useTranslation();
  const timer = useRef(null);
  const startTimer = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(toast.id), toast.duration);
  };
  // Se va solo; con el cursor o el foco encima se queda (para poder leerlo o pulsar «Deshacer»).
  useEffect(() => {
    startTimer();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      className={`toast toast--${toast.type}`}
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={startTimer}
      onFocus={() => clearTimeout(timer.current)}
      onBlur={startTimer}
    >
      <span className="toast__message">{toast.message}</span>
      {toast.action && (
        <button type="button" className="toast__action" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast__close" aria-label={t("toast.close")} onClick={() => dismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}

// La confirmación propia (reemplaza a window.confirm): modal con foco atrapado, Escape = cancelar. En una acción
// destructiva el foco empieza en «Cancelar», para que un Enter distraído no borre nada.
function ConfirmModal({ request }) {
  const { t } = useTranslation();
  const boxRef = useRef(null);
  const { message, opts } = request;
  const [text, setText] = useState(opts.defaultValue ?? "");

  useEffect(() => {
    const previous = document.activeElement;
    const buttons = boxRef.current?.querySelectorAll("button") ?? [];
    const field = boxRef.current?.querySelector("input");
    if (field) {
      field.focus();
      field.select();
    } else {
      (opts.danger ? buttons[0] : buttons[buttons.length - 1])?.focus();
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        resolveConfirm(false);
      }
      if (e.key === "Tab" && boxRef.current) {
        const focusable = [...boxRef.current.querySelectorAll("button, input")];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [request.id, opts.danger]);

  return (
    <div className="confirm-dialog" role="alertdialog" data-manages-focus aria-modal="true" aria-describedby="confirm-dialog-message">
      <div className="confirm-dialog__backdrop" onClick={() => resolveConfirm(false)} aria-hidden="true" />
      <div className="confirm-dialog__box card" ref={boxRef}>
        <p id="confirm-dialog-message" className="confirm-dialog__message">
          {message}
        </p>
        {opts.input && (
          <input
            className="confirm-dialog__input"
            aria-label={message}
            value={text}
            readOnly={Boolean(opts.readOnly)}
            placeholder={opts.placeholder || ""}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => opts.readOnly && e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                resolveConfirm(true, text);
              }
            }}
          />
        )}
        <div className="confirm-dialog__actions">
          {!opts.hideCancel && (
            <button type="button" className="btn btn-outline" onClick={() => resolveConfirm(false)}>
              {opts.cancelLabel || t("toast.cancel")}
            </button>
          )}
          <button type="button" className={`btn ${opts.danger ? "btn-danger" : "btn-primary"}`} onClick={() => resolveConfirm(true, text)}>
            {opts.confirmLabel || t("toast.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Se monta una sola vez, arriba de todo (App.jsx): dibuja los avisos y la confirmación pendiente.
export default function Toaster() {
  const { t } = useTranslation();
  const toasts = useSyncExternalStore(subscribe, getToasts);
  const request = useSyncExternalStore(subscribe, getConfirmRequest);
  return (
    <>
      <div className="toaster" role="region" aria-label={t("toast.region")}>
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} />
        ))}
      </div>
      {request && <ConfirmModal key={request.id} request={request} />}
    </>
  );
}
