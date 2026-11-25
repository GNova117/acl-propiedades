import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./PdfViewer.css";

// Visor de PDF que dibuja cada página en un <canvas> con pdf.js.
//
// Por qué existe: en iPhone y en muchos Android un <iframe> con un PDF muestra solo la primera página, sin forma de pasar a
// las demás — y el cliente tiene que LEER el documento completo antes de firmarlo (/firmar). Aquí todas las páginas quedan
// una debajo de otra y se desplazan con la página. pdf.js se carga bajo demanda (import dinámico): no pesa en la carga inicial.
//
// Si pdf.js no puede abrir el archivo se cae al <iframe> de siempre. Lo elige DocumentFrame (ver lib/pdfViewerSupport.js).
export default function PdfViewer({ url, title, className = "" }) {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | failed
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pdf = null;
    const host = hostRef.current;
    setState("loading");
    setPages(0);

    (async () => {
      try {
        const [pdfjs, { default: workerUrl }] = await Promise.all([
          import("pdfjs-dist/build/pdf.mjs"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled || !host) return;
        host.replaceChildren();
        setPages(pdf.numPages);
        const width = Math.max(240, host.clientWidth || 320);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.className = "pdf-viewer__page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${title} — ${n}/${pdf.numPages}`);
          host.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
          if (n === 1) setState("ready");
        }
        if (!cancelled) setState("ready");
      } catch (err) {
        console.error("PdfViewer", err);
        if (!cancelled) setState("failed");
      }
    })();

    return () => {
      cancelled = true;
      pdf?.destroy?.();
    };
  }, [url, title]);

  if (state === "failed") {
    return <iframe src={url} title={title} className={className} />;
  }
  return (
    <div className={`pdf-viewer ${className}`}>
      {state === "loading" && <span className="spinner pdf-viewer__spinner" aria-label={t("common.loading", { defaultValue: "Cargando…" })} />}
      {state === "ready" && pages > 1 && <p className="pdf-viewer__count">{t("pdfViewer.pages", { count: pages, defaultValue: "{{count}} páginas" })}</p>}
      <div ref={hostRef} className="pdf-viewer__pages" />
    </div>
  );
}
