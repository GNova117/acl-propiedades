import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./SignatureModal.css";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = 10;

// Cuadro para firmar con el dedo, el lápiz o el mouse. Devuelve un PNG con
// fondo transparente, recortado al trazo. Es una firma autógrafa digitalizada
// (una imagen), no una firma electrónica avanzada con certificado.
export default function SignatureModal({ title, onAccept, onCancel }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const bounds = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "#0a1120";

    const onKey = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("admin-menu-open"); // bloquea el scroll de fondo
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("admin-menu-open");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  };

  const grow = ({ x, y }) => {
    const b = bounds.current;
    bounds.current = b
      ? { minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y) }
      : { minX: x, minY: y, maxX: x, maxY: y };
  };

  const handleDown = (e) => {
    e.preventDefault();
    try {
      canvasRef.current.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten: se dibuja igual */
    }
    drawing.current = true;
    const p = point(e);
    last.current = p;
    grow(p);
    // Un punto suelto (toque sin arrastrar) también deja marca.
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1120";
    ctx.fill();
    setHasInk(true);
  };

  const handleMove = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    grow(p);
  };

  const handleUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    bounds.current = null;
    setHasInk(false);
  };

  const accept = () => {
    const b = bounds.current;
    if (!b) return;
    const canvas = canvasRef.current;
    const ratio = canvas.width / WIDTH;
    const x = Math.max(0, b.minX - PAD);
    const y = Math.max(0, b.minY - PAD);
    const w = Math.min(WIDTH, b.maxX + PAD) - x;
    const h = Math.min(HEIGHT, b.maxY + PAD) - y;
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(w * ratio));
    out.height = Math.max(1, Math.round(h * ratio));
    out.getContext("2d").drawImage(canvas, x * ratio, y * ratio, w * ratio, h * ratio, 0, 0, out.width, out.height);
    onAccept({ image: out.toDataURL("image/png"), signedAt: new Date().toISOString() });
  };

  return (
    <div className="signature-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="signature-modal__backdrop" onClick={onCancel} aria-hidden="true" />
      <div className="signature-modal__box card">
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p className="form-hint">{t("signature.hint")}</p>
        <canvas
          ref={canvasRef}
          className="signature-modal__canvas"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          aria-label={t("signature.canvas")}
        />
        <div className="signature-modal__actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={clear} disabled={!hasInk}>
            {t("signature.clear")}
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={accept} disabled={!hasInk}>
            {t("signature.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
