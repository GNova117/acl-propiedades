import { lazy, Suspense } from "react";
import { prefersCanvasViewer } from "../lib/pdfViewerSupport";

const PdfViewer = lazy(() => import("./PdfViewer"));

// Muestra un PDF: en teléfono/tableta con el visor por páginas (el <iframe> ahí enseña solo la primera hoja), en escritorio con
// el visor nativo del navegador, que es mejor (búsqueda, zoom, impresión).
export default function DocumentFrame({ url, title, className = "" }) {
  if (!prefersCanvasViewer()) return <iframe src={url} title={title} className={className} />;
  return (
    <Suspense fallback={<span className="spinner" />}>
      <PdfViewer url={url} title={title} className={className} />
    </Suspense>
  );
}
