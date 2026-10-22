import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import "./Panorama360.css";

// Visor de fotos 360° (panorámicas equirectangulares): la foto se proyecta
// por dentro de una esfera y OrbitControls deja "mirar alrededor" arrastrando
// con el mouse o el dedo. No es un recorrido 3D del plano (eso ya existe en
// Construcción) — aquí es una sola foto 360° por espacio, la forma más
// barata de dar una vista inmersiva de una propiedad ya construida.
function PanoramaSphere({ src }) {
  const texture = useTexture(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

export default function Panorama360({ images, onClose }) {
  const { t } = useTranslation();
  const list = (images || []).filter(Boolean);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (list.length === 0) return null;

  return (
    <div className="panorama-modal" role="dialog" aria-modal="true" aria-label={t("panorama360.title")}>
      <div className="panorama-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="panorama-modal__box">
        <div className="panorama-modal__head">
          <h2>{t("panorama360.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="panorama-modal__hint">{t("panorama360.dragHint")}</p>
        <div className="panorama-modal__canvas">
          <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }}>
            <Suspense fallback={null}>
              <PanoramaSphere src={list[index]} />
            </Suspense>
            <OrbitControls enableZoom enablePan={false} rotateSpeed={-0.4} zoomSpeed={0.6} minDistance={0.1} maxDistance={400} />
          </Canvas>
        </div>
        {list.length > 1 && (
          <div className="panorama-modal__thumbs" role="listbox" aria-label={t("panorama360.choose")}>
            {list.map((src, i) => (
              <button
                key={src + i}
                type="button"
                role="option"
                aria-selected={i === index}
                className={`panorama-modal__thumb ${i === index ? "panorama-modal__thumb--active" : ""}`}
                onClick={() => setIndex(i)}
              >
                <img src={src} alt={`360° ${i + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
