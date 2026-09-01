import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateDocumentQuality } from "../lib/imageQuality";
import "./DocumentCapture.css";

// object-fit: cover escala el video para llenar el contenedor recortando el
// sobrante, centrado — hay que deshacer esa transformación para saber qué
// región del video nativo corresponde al marco guía en pantalla.
function getCoverCrop(video, container) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(cw / vw, ch / vh);
  return {
    scale,
    offsetX: (vw * scale - cw) / 2,
    offsetY: (vh * scale - ch) / 2,
  };
}

function captureFromVideo(video, container, frameEl, outW = 1000) {
  const { scale, offsetX, offsetY } = getCoverCrop(video, container);
  const f = frameEl.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  const sx = (f.left - c.left + offsetX) / scale;
  const sy = (f.top - c.top + offsetY) / scale;
  const sWidth = f.width / scale;
  const sHeight = f.height / scale;
  const outH = Math.round(outW / (sWidth / sHeight));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  canvas.getContext("2d").drawImage(video, sx, sy, sWidth, sHeight, 0, 0, outW, outH);
  return canvas;
}

// Fallback sin cámara: se valida la imagen completa (sin recorte al marco,
// porque no hay <video> de por medio).
function captureFromImage(img, maxW = 1000) {
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

export default function DocumentCapture({ docType, aspectRatio = 1.59, onAccept, onCancel }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState("idle");
  const [failReasons, setFailReasons] = useState([]);
  const [result, setResult] = useState(null);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const streamRef = useRef(null);
  const returnPhaseRef = useRef("idle");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopStream(), []);

  const activateCamera = async () => {
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
      await video.play();
      setPhase("streaming");
    } catch {
      setPhase("camera-error");
    }
  };

  const evaluate = async (canvas) => {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quality = evaluateDocumentQuality(imageData);
    if (quality.passed) {
      const blob = await canvasToBlob(canvas);
      setResult({
        blob,
        previewUrl: URL.createObjectURL(blob),
        qualityMetrics: { sharpness: quality.sharpness, brightness: quality.brightness, edgeDensity: quality.edgeDensity },
      });
      setPhase("valid");
    } else {
      setFailReasons(quality.failReasons);
      setPhase("invalid");
    }
  };

  const handleCapture = async () => {
    returnPhaseRef.current = "streaming";
    setPhase("validating");
    const canvas = captureFromVideo(videoRef.current, containerRef.current, frameRef.current);
    await evaluate(canvas);
  };

  const handleFileInput = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    returnPhaseRef.current = "camera-error";
    setPhase("validating");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const canvas = captureFromImage(img);
      URL.revokeObjectURL(url);
      await evaluate(canvas);
    };
    img.src = url;
  };

  const handleRetake = () => {
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    setResult(null);
    setFailReasons([]);
    setPhase(returnPhaseRef.current);
  };

  const handleConfirm = () => {
    stopStream();
    onAccept(result);
  };

  const handleCancel = () => {
    stopStream();
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    onCancel();
  };

  return (
    <div className="document-capture">
      <div className="document-capture__header">
        <h3>{t(`documentCapture.docTypes.${docType}`)}</h3>
        <button type="button" className="document-capture__close" onClick={handleCancel} aria-label={t("documentCapture.cancel")}>
          ×
        </button>
      </div>

      {(phase === "idle" || phase === "requesting") && (
        <div className="document-capture__prompt">
          <p>{t("documentCapture.instructions")}</p>
          <button type="button" className="btn btn-primary" onClick={activateCamera} disabled={phase === "requesting"}>
            {phase === "requesting" ? <span className="spinner" /> : null}
            {t("documentCapture.activateCamera")}
          </button>
        </div>
      )}

      {(phase === "streaming" || phase === "validating") && (
        <>
          <div className="document-capture__stage" ref={containerRef}>
            <video ref={videoRef} className="document-capture__video" playsInline muted />
            <div ref={frameRef} className="document-capture__frame" style={{ aspectRatio }}>
              <span className="document-capture__corner document-capture__corner--tl" />
              <span className="document-capture__corner document-capture__corner--tr" />
              <span className="document-capture__corner document-capture__corner--bl" />
              <span className="document-capture__corner document-capture__corner--br" />
            </div>
            {phase === "validating" && (
              <div className="document-capture__overlay-status">
                <span className="spinner" />
                {t("documentCapture.analyzing")}
              </div>
            )}
          </div>
          <div className="document-capture__actions">
            <p className="form-hint">{t("documentCapture.instructions")}</p>
            <button type="button" className="btn btn-primary" onClick={handleCapture} disabled={phase === "validating"}>
              {t("documentCapture.capture")}
            </button>
          </div>
        </>
      )}

      {phase === "invalid" && (
        <div className="document-capture__result document-capture__result--invalid">
          <ul className="document-capture__errors">
            {failReasons.map((reason) => (
              <li key={reason}>{t(`documentCapture.errors.${reason}`)}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={handleRetake}>
            {t("documentCapture.retake")}
          </button>
        </div>
      )}

      {phase === "valid" && result && (
        <div className="document-capture__result document-capture__result--valid">
          <div className="document-capture__valid-badge">✓ {t("documentCapture.validCapture")}</div>
          <img src={result.previewUrl} alt="" className="document-capture__preview" />
          <div className="document-capture__actions">
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              {t("documentCapture.confirm")}
            </button>
            <button type="button" className="btn btn-outline" onClick={handleRetake}>
              {t("documentCapture.retake")}
            </button>
          </div>
        </div>
      )}

      {phase === "camera-error" && (
        <div className="document-capture__result">
          <p className="form-error">{t("documentCapture.cameraError")}</p>
          <p className="form-hint">{t("documentCapture.cameraErrorHint")}</p>
          <label className="btn btn-outline document-capture__upload-btn">
            <input type="file" accept="image/*" onChange={handleFileInput} hidden />
            {t("documentCapture.uploadInstead")}
          </label>
        </div>
      )}
    </div>
  );
}
