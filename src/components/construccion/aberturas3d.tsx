// Puertas y ventanas en 3D, una forma distinta por estilo. Se dibujan en el marco local del muro:
// x a lo largo del muro (centrado en la abertura), y hacia arriba, z a lo ancho del espesor.
import { Bx, Cy } from "./primitivas3d";
import { estiloDe } from "../../lib/construccion/estilosAbertura";
import type { Abertura } from "../../lib/construccion/types";

const T = 0.15; // espesor del muro
const MADERA = "#b4793a";
const MADERA_OSCURA = "#5b3a1a";
const ALUMINIO = "#9ca3af";
const VIDRIO = "#7dd3fc";

function Marco({ ab, j = 0.06, color, lados = true, arriba = true }: { ab: Abertura; j?: number; color: string; lados?: boolean; arriba?: boolean }) {
  const depth = T + 0.03;
  return (
    <>
      {lados &&
        [-1, 1].map((l) => <Bx key={l} pos={[l * (ab.anchoM / 2 - j / 2), ab.altoDesdePisoM, 0]} size={[j, ab.altoM, depth]} color={color} />)}
      {arriba && <Bx pos={[0, ab.altoDesdePisoM + ab.altoM - j, 0]} size={[ab.anchoM, j, depth]} color={color} />}
    </>
  );
}

const Manija = ({ x, y, z = 0.05 }: { x: number; y: number; z?: number }) => (
  <>
    {[1, -1].map((c) => (
      <Cy key={c} pos={[x, y - 0.01, c * z]} r={0.018} h={0.12} color="#d4d4d8" metal rot={[0, 0, 0]} />
    ))}
  </>
);

export function Puerta3D({ ab }: { ab: Abertura }) {
  const estilo = estiloDe(ab);
  const j = 0.06;
  const y0 = ab.altoDesdePisoM;
  const hojaAncho = Math.max(0.1, ab.anchoM - 2 * j);
  const hojaAlto = Math.max(0.1, ab.altoM - j);
  const yM = y0 + Math.min(1.0, hojaAlto / 2);

  if (estilo === "arco") {
    // Vano con jambas y dintel de madera, sin hoja.
    return (
      <group position={[ab.offsetM, 0, 0]}>
        <Marco ab={ab} j={0.1} color="#e7e5e4" />
      </group>
    );
  }

  if (estilo === "cochera") {
    // Portón seccional: paneles horizontales con juntas, guías laterales y caja del rodillo.
    const paneles = Math.max(3, Math.round(ab.altoM / 0.5));
    const alto = ab.altoM / paneles;
    return (
      <group position={[ab.offsetM, 0, 0]}>
        <Marco ab={ab} j={0.08} color="#52525b" />
        {Array.from({ length: paneles }, (_, i) => (
          <Bx key={i} pos={[0, y0 + i * alto + 0.005, 0]} size={[ab.anchoM - 0.16, alto - 0.015, 0.05]} color={i % 2 ? "#e7e5e4" : "#d6d3d1"} />
        ))}
        <Bx pos={[0, y0 + ab.altoM - 0.1, 0.02]} size={[ab.anchoM, 0.14, T + 0.08]} color="#52525b" />
        <Bx pos={[ab.anchoM / 2 - 0.35, y0 + 0.9, 0.04]} size={[0.3, 0.06, 0.02]} color="#27272a" />
      </group>
    );
  }

  if (estilo === "corrediza") {
    const pan = ab.anchoM / 2 + 0.03;
    return (
      <group position={[ab.offsetM, 0, 0]}>
        <Marco ab={ab} j={0.07} color={ALUMINIO} />
        <Bx pos={[0, y0, 0]} size={[ab.anchoM, 0.05, T * 0.6]} color={ALUMINIO} />
        {[-1, 1].map((l) => (
          <group key={l} position={[l * (pan / 2 - 0.02), 0, l * 0.035]}>
            <Bx pos={[0, y0 + 0.05, 0]} size={[pan, ab.altoM - 0.12, 0.012]} color={VIDRIO} opacity={0.35} />
            <Bx pos={[0, y0 + 0.05, 0]} size={[pan, 0.04, 0.03]} color={ALUMINIO} />
            <Bx pos={[0, y0 + ab.altoM - 0.11, 0]} size={[pan, 0.04, 0.03]} color={ALUMINIO} />
            {[-1, 1].map((m) => (
              <Bx key={m} pos={[m * (pan / 2 - 0.02), y0 + 0.05, 0]} size={[0.04, ab.altoM - 0.12, 0.03]} color={ALUMINIO} />
            ))}
            <Bx pos={[-l * (pan / 2 - 0.08), y0 + 1.0, l * 0.025]} size={[0.025, 0.2, 0.02]} color="#27272a" />
          </group>
        ))}
      </group>
    );
  }

  if (estilo === "vidrio") {
    return (
      <group position={[ab.offsetM, 0, 0]}>
        <Marco ab={ab} j={0.06} color={ALUMINIO} />
        <Bx pos={[0, y0, 0]} size={[hojaAncho, hojaAlto, 0.02]} color={VIDRIO} opacity={0.35} />
        {/* Perfil de aluminio de la hoja y manija de barra */}
        <Bx pos={[0, y0, 0]} size={[hojaAncho, 0.05, 0.035]} color={ALUMINIO} />
        <Bx pos={[0, y0 + hojaAlto - 0.05, 0]} size={[hojaAncho, 0.05, 0.035]} color={ALUMINIO} />
        {[-1, 1].map((l) => (
          <Bx key={l} pos={[l * (hojaAncho / 2 - 0.025), y0, 0]} size={[0.05, hojaAlto, 0.035]} color={ALUMINIO} />
        ))}
        {[1, -1].map((c) => (
          <Bx key={c} pos={[hojaAncho / 2 - 0.12, yM - 0.25, c * 0.05]} size={[0.025, 0.5, 0.025]} color="#d4d4d8" metal />
        ))}
      </group>
    );
  }

  if (estilo === "doble") {
    const hoja = hojaAncho / 2 - 0.005;
    return (
      <group position={[ab.offsetM, 0, 0]}>
        <Marco ab={ab} j={j} color={MADERA_OSCURA} />
        {[-1, 1].map((l) => (
          <group key={l} position={[l * (hoja / 2 + 0.005), 0, 0]}>
            <Bx pos={[0, y0, 0]} size={[hoja, hojaAlto, 0.045]} color={MADERA} />
            <Bx pos={[0, y0 + hojaAlto * 0.12, 0.025]} size={[hoja * 0.7, hojaAlto * 0.33, 0.012]} color="#a16a30" />
            <Bx pos={[0, y0 + hojaAlto * 0.55, 0.025]} size={[hoja * 0.7, hojaAlto * 0.33, 0.012]} color="#a16a30" />
            <Manija x={-l * (hoja / 2 - 0.08)} y={yM} />
          </group>
        ))}
      </group>
    );
  }

  if (estilo === "principal") {
    return (
      <group position={[ab.offsetM, 0, 0]}>
        <Marco ab={ab} j={0.09} color={MADERA_OSCURA} />
        <Bx pos={[0, y0, 0]} size={[hojaAncho - 0.06, hojaAlto - 0.03, 0.06]} color="#7c4a1d" />
        {/* Paneles elevados de la hoja */}
        {[0.12, 0.56].map((f) => (
          <Bx key={f} pos={[0, y0 + hojaAlto * f, 0.035]} size={[hojaAncho * 0.62, hojaAlto * 0.34, 0.015]} color="#8f5a26" r={0.01} />
        ))}
        {[1, -1].map((c) => (
          <Bx key={c} pos={[hojaAncho / 2 - 0.14, yM - 0.04, c * 0.05]} size={[0.14, 0.03, 0.03]} color="#fbbf24" metal />
        ))}
        <Cy pos={[0, y0 + hojaAlto * 0.86, 0.06]} r={0.012} h={0.02} color="#fbbf24" metal rot={[Math.PI / 2, 0, 0]} />
      </group>
    );
  }

  // interior
  return (
    <group position={[ab.offsetM, 0, 0]}>
      <Marco ab={ab} j={j} color={MADERA_OSCURA} />
      <Bx pos={[0, y0, 0]} size={[hojaAncho, hojaAlto, 0.045]} color={MADERA} />
      {[1, -1].map((c) => (
        <Cy key={c} pos={[hojaAncho / 2 - 0.1, yM, c * 0.045]} r={0.035} h={0.03} color="#d4d4d8" metal rot={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}

function VidrioVentana({ x = 0, w, z = 0, opacity = 0.4, color = VIDRIO, y0, j, alto }: { x?: number; w: number; z?: number; opacity?: number; color?: string; y0: number; j: number; alto: number }) {
  return <Bx pos={[x, y0 + j, z]} size={[w, alto, 0.012]} color={color} opacity={opacity} />;
}

export function Ventana3D({ ab }: { ab: Abertura }) {
  const estilo = estiloDe(ab);
  const j = 0.05;
  const marco = "#e5e7eb";
  const y0 = ab.altoDesdePisoM;
  const vAncho = Math.max(0.05, ab.anchoM - 2 * j);
  const vAlto = Math.max(0.05, ab.altoM - 2 * j);
  const profundidad = T + 0.02;
  return (
    <group position={[ab.offsetM, 0, 0]}>
      {/* Marco */}
      {[-1, 1].map((l) => (
        <Bx key={l} pos={[l * (ab.anchoM / 2 - j / 2), y0, 0]} size={[j, ab.altoM, profundidad]} color={marco} />
      ))}
      {[0, 1].map((a) => (
        <Bx key={a} pos={[0, y0 + (a ? ab.altoM - j : 0), 0]} size={[ab.anchoM, j, profundidad]} color={marco} />
      ))}

      {estilo === "fija" && <VidrioVentana w={vAncho} y0={y0} j={j} alto={vAlto} />}

      {(estilo === "corrediza" || estilo === "ventanal") && (
        <>
          {[-1, 1].map((l) => (
            <group key={l} position={[0, 0, l * 0.03]}>
              <VidrioVentana x={l * (vAncho / 4 - 0.01)} w={vAncho / 2 + 0.03} y0={y0} j={j} alto={vAlto} />
              <Bx pos={[l * (vAncho / 4 - 0.01), y0 + j, 0]} size={[vAncho / 2 + 0.03, 0.03, 0.025]} color={marco} />
              <Bx pos={[l * (vAncho / 4 - 0.01), y0 + ab.altoM - j - 0.03, 0]} size={[vAncho / 2 + 0.03, 0.03, 0.025]} color={marco} />
            </group>
          ))}
          <Bx pos={[0, y0 + j, 0]} size={[0.035, vAlto, 0.07]} color={marco} />
        </>
      )}

      {estilo === "abatible" && (
        <>
          <VidrioVentana x={-vAncho / 4 - 0.005} w={vAncho / 2 - 0.02} y0={y0} j={j} alto={vAlto} />
          <VidrioVentana x={vAncho / 4 + 0.005} w={vAncho / 2 - 0.02} y0={y0} j={j} alto={vAlto} />
          <Bx pos={[0, y0 + j, 0]} size={[0.045, vAlto, 0.045]} color={marco} />
          {[-1, 1].map((l) => (
            <Bx key={l} pos={[l * 0.04, y0 + ab.altoM / 2, 0.035]} size={[0.015, 0.1, 0.02]} color="#9ca3af" metal />
          ))}
          <Bx pos={[0, y0 + ab.altoM * 0.5, 0]} size={[vAncho, 0.03, 0.04]} color={marco} />
        </>
      )}

      {estilo === "bano" && <VidrioVentana w={vAncho} color="#e0f2fe" opacity={0.85} y0={y0} j={j} alto={vAlto} />}

      {/* Repisa exterior (no en un ventanal que llega al piso) */}
      {y0 > 0.2 && <Bx pos={[0, y0 - 0.045, 0.04]} size={[ab.anchoM + 0.12, 0.04, T + 0.1]} color="#d4d4d8" />}
    </group>
  );
}
