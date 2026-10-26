import { useState } from "react";

// Video de la ficha. Si el video es vertical (tipo Reel) se muestra en un
// marco angosto 9:16 en vez de estirarlo al ancho de la columna.
export default function PropertyVideo({ src }) {
  const [vertical, setVertical] = useState(false);
  return (
    <video
      className={vertical ? "property-detail__video--vertical" : undefined}
      src={src}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => setVertical(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
    />
  );
}
