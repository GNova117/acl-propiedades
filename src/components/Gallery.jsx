import { useState } from "react";
import "./Gallery.css";

export default function Gallery({ images, alt }) {
  const [active, setActive] = useState(0);
  const list = images && images.length > 0 ? images : ["https://placehold.co/1000x700?text=ACL+Propiedades"];

  return (
    <div className="gallery">
      <div className="gallery__main">
        {/* Es la imagen principal de la ficha de propiedad — normalmente el
            LCP de la página — así que se carga eager, no lazy. */}
        <img src={list[active]} alt={`${alt} - imagen ${active + 1}`} decoding="async" fetchPriority="high" />
      </div>
      {list.length > 1 && (
        <div className="gallery__thumbs">
          {list.map((src, index) => (
            <button
              key={src + index}
              type="button"
              className={`gallery__thumb ${index === active ? "gallery__thumb--active" : ""}`}
              onClick={() => setActive(index)}
              aria-label={`Ver imagen ${index + 1}`}
            >
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
