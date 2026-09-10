import { useEffect, useRef, useState } from "react";
import "./Reveal.css";

// Envuelve cualquier contenido para que aparezca con una animación sutil
// (opacidad + desplazamiento) la primera vez que entra en pantalla al
// hacer scroll, en vez de estar ahí desde que carga la página. Se
// desconecta el observer en cuanto aparece una vez — no vuelve a
// ocultarse si se hace scroll hacia arriba y abajo otra vez.
export default function Reveal({ children, delay = 0, as: Tag = "div", className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal ${visible ? "reveal--visible" : ""} ${className}`.trim()} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}
