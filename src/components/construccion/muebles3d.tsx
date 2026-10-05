/* eslint-disable react-refresh/only-export-components, react/only-export-components */
// Modelos 3D de muebles y equipos: en vez de un cubo del color de la zona, cada pieza tiene su forma
// (refri con puertas y manijas, estufa con quemadores, sofá con respaldo y cojines…). Se arman con cajas
// y cilindros en el marco local del objeto: x = ancho, z = largo (el frente mira a +z), y hacia arriba,
// centrado en x/z y apoyado en el piso (y = 0).
import type { ReactNode } from "react";
import { Bx, Cy, Sp } from "./primitivas3d";

type M = { w: number; d: number; h: number; c: string };
type Modelo = (m: M) => ReactNode;

const BLANCO = "#f5f5f4";
const ACERO = "#d1d5db";
const NEGRO = "#27272a";
const MADERA = "#b4793a";
const MADERA_OSC = "#7c4a1d";
const PIEDRA = "#57534e";
const aclarar = (hex: string, f = 0.25) => {
  const n = parseInt(hex.slice(1), 16);
  const m = (v: number) => Math.round(v + (255 - v) * f);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => m(v).toString(16).padStart(2, "0")).join("")}`;
};

const Sofa: Modelo = ({ w, d, h, c }) => {
  const asiento = h * 0.5;
  const n = w > 1.7 ? 3 : w > 1.15 ? 2 : 1;
  const cw = (w - 0.3) / n;
  return (
    <>
      {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Bx key={`${a}${b}`} pos={[a * (w / 2 - 0.06), 0, b * (d / 2 - 0.06)]} size={[0.05, 0.08, 0.05]} color={NEGRO} />))}
      <Bx pos={[0, 0.08, 0]} size={[w, asiento - 0.08, d]} color={c} r={0.05} />
      <Bx pos={[0, asiento - 0.04, -d / 2 + 0.11]} size={[w, h - asiento + 0.04, 0.22]} color={c} r={0.07} />
      {[-1, 1].map((l) => (
        <Bx key={l} pos={[l * (w / 2 - 0.07), 0.08, 0]} size={[0.14, asiento + 0.14, d]} color={c} r={0.06} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const x = -((n - 1) * cw) / 2 + i * cw;
        return (
          <group key={i}>
            <Bx pos={[x, asiento - 0.02, 0.06]} size={[cw - 0.02, 0.13, d - 0.32]} color={aclarar(c, 0.18)} r={0.05} />
            <Bx pos={[x, asiento + 0.1, -d / 2 + 0.3]} size={[cw - 0.04, h - asiento - 0.12, 0.14]} color={aclarar(c, 0.18)} r={0.06} rot={[-0.18, 0, 0]} />
          </group>
        );
      })}
    </>
  );
};

const MesaRect: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, h - 0.045, 0]} size={[w, 0.045, d]} color={MADERA} r={0.012} />
    {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Bx key={`${a}${b}`} pos={[a * (w / 2 - 0.07), 0, b * (d / 2 - 0.07)]} size={[0.055, h - 0.045, 0.055]} color={MADERA_OSC} />))}
  </>
);

const MesaJuntas: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, h - 0.05, 0]} size={[w, 0.05, d]} color="#a16a30" r={0.025} />
    {[-1, 1].map((l) => (
      <Bx key={l} pos={[l * (w / 2 - 0.4), 0, 0]} size={[0.08, h - 0.05, d * 0.6]} color={MADERA_OSC} />
    ))}
  </>
);

const MesaRedonda: Modelo = ({ w, h }) => (
  <>
    <Cy pos={[0, h - 0.045, 0]} r={w / 2} h={0.045} color={MADERA} seg={32} />
    <Cy pos={[0, 0.03, 0]} r={0.045} h={h - 0.075} color={MADERA_OSC} />
    <Cy pos={[0, 0, 0]} r={Math.min(0.28, w / 3)} h={0.03} color={MADERA_OSC} seg={24} />
  </>
);

const MesaCentro: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, h - 0.04, 0]} size={[w, 0.04, d]} color="#e7e5e4" r={0.01} opacity={0.9} />
    <Bx pos={[0, 0.08, 0]} size={[w - 0.12, 0.025, d - 0.12]} color={MADERA} />
    {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Bx key={`${a}${b}`} pos={[a * (w / 2 - 0.05), 0, b * (d / 2 - 0.05)]} size={[0.035, h - 0.04, 0.035]} color={NEGRO} />))}
  </>
);

const Silla: Modelo = ({ w, d, h, c }) => (
  <>
    <Bx pos={[0, 0.43, 0]} size={[w, 0.045, d]} color={c} r={0.015} />
    <Bx pos={[0, 0.45, -d / 2 + 0.02]} size={[w, h - 0.45, 0.04]} color={c} r={0.015} />
    {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Bx key={`${a}${b}`} pos={[a * (w / 2 - 0.03), 0, b * (d / 2 - 0.03)]} size={[0.035, 0.43, 0.035]} color={MADERA_OSC} />))}
  </>
);

const SillaOficina: Modelo = ({ w, d, c }) => (
  <>
    <Cy pos={[0, 0.1, 0]} r={0.025} h={0.33} color={NEGRO} />
    {Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2;
      const r = Math.min(w, d) * 0.45;
      return (
        <group key={i}>
          <Bx pos={[Math.cos(a) * r * 0.5, 0.07, Math.sin(a) * r * 0.5]} size={[r, 0.03, 0.035]} color={NEGRO} rot={[0, -a, 0]} />
          <Sp pos={[Math.cos(a) * r, 0.03, Math.sin(a) * r]} r={0.03} color={NEGRO} />
        </group>
      );
    })}
    <Bx pos={[0, 0.43, 0]} size={[w * 0.82, 0.07, d * 0.82]} color={c} r={0.03} />
    <Bx pos={[0, 0.5, -d * 0.36]} size={[w * 0.78, 0.45, 0.06]} color={c} r={0.03} rot={[-0.1, 0, 0]} />
  </>
);

const Escritorio: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, h - 0.04, 0]} size={[w, 0.04, d]} color={MADERA} r={0.01} />
    <Bx pos={[-w / 2 + 0.24, 0, 0]} size={[0.44, h - 0.04, d - 0.04]} color={MADERA_OSC} />
    {[0.12, 0.3, 0.48].map((y) => (
      <group key={y}>
        <Bx pos={[-w / 2 + 0.24, y, d / 2 - 0.015]} size={[0.4, 0.15, 0.015]} color="#8f5a26" />
        <Bx pos={[-w / 2 + 0.24, y + 0.065, d / 2 + 0.005]} size={[0.12, 0.02, 0.015]} color={ACERO} metal />
      </group>
    ))}
    <Bx pos={[w / 2 - 0.03, 0, 0]} size={[0.04, h - 0.04, d - 0.06]} color={MADERA_OSC} />
    <Bx pos={[0, h * 0.55, -d / 2 + 0.01]} size={[w - 0.5, h * 0.35, 0.02]} color={MADERA_OSC} />
  </>
);

const MuebleTV: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0.06, 0]} size={[w, h - 0.06, d]} color={MADERA_OSC} r={0.015} />
    {[-1, 1].map((l) => (
      <Bx key={l} pos={[l * (w / 4), 0.08, d / 2 + 0.003]} size={[w / 2 - 0.05, h - 0.1, 0.012]} color="#8f5a26" />
    ))}
    {[-1, 1].map((l) => (
      <Bx key={l} pos={[l * (w / 2 - 0.06), 0, 0]} size={[0.04, 0.06, d - 0.06]} color={NEGRO} />
    ))}
    <Bx pos={[0, h, 0]} size={[w * 0.04, 0.12, 0.12]} color={NEGRO} />
    <Bx pos={[0, h + 0.1, 0]} size={[w * 0.72, w * 0.72 * 0.56, 0.05]} color={NEGRO} r={0.01} />
  </>
);

const Repisas = ({ w, d, h, puertas = false }: M & { puertas?: boolean }) => {
  const n = Math.max(3, Math.round(h / 0.38));
  return (
    <>
      {[-1, 1].map((l) => (
        <Bx key={l} pos={[l * (w / 2 - 0.015), 0, 0]} size={[0.03, h, d]} color={MADERA_OSC} />
      ))}
      <Bx pos={[0, 0, -d / 2 + 0.01]} size={[w, h, 0.02]} color="#6b3f1d" />
      {Array.from({ length: n + 1 }, (_, i) => (
        <Bx key={i} pos={[0, (i * (h - 0.03)) / n, 0]} size={[w - 0.06, 0.03, d - 0.02]} color={MADERA} />
      ))}
      {!puertas &&
        Array.from({ length: n }, (_, i) => (
          <Bx key={`l${i}`} pos={[-w * 0.15 + (i % 3) * 0.08, (i * (h - 0.03)) / n + 0.03, 0]} size={[w * 0.35, Math.min(0.26, (h - 0.03) / n - 0.06), d * 0.7]} color={["#2563eb", "#dc2626", "#16a34a", "#ca8a04"][i % 4]} opacity={0.9} />
        ))}
      {puertas &&
        [-1, 1].map((l) => (
          <Bx key={l} pos={[l * (w / 4), 0.02, d / 2 + 0.005]} size={[w / 2 - 0.02, h - 0.04, 0.02]} color="#8f5a26" />
        ))}
    </>
  );
};

/** Gabinete / cómoda / isla: cuerpo, cubierta que sobresale, y puertas o cajones con jaladeras. */
const Gabinete = ({ w, d, h, topColor = PIEDRA, bodyColor = MADERA_OSC, cajones = false }: M & { topColor?: string; bodyColor?: string; cajones?: boolean }) => {
  const n = Math.max(1, Math.round(w / 0.5));
  const filas = cajones ? Math.max(2, Math.round(h / 0.25)) : 1;
  const frente = (h - 0.1) / filas;
  return (
    <>
      <Bx pos={[0, 0.06, 0]} size={[w - 0.02, h - 0.1, d - 0.02]} color={bodyColor} />
      <Bx pos={[0, 0, 0]} size={[w - 0.1, 0.06, d - 0.1]} color={NEGRO} />
      <Bx pos={[0, h - 0.04, 0.01]} size={[w, 0.04, d + 0.02]} color={topColor} r={0.008} />
      {Array.from({ length: filas }, (_, f) =>
        Array.from({ length: cajones ? 1 : n }, (_, i) => {
          const fw = (w - 0.06) / (cajones ? 1 : n);
          const x = -w / 2 + 0.03 + fw * (i + 0.5);
          const y = 0.07 + f * frente;
          return (
            <group key={`${f}-${i}`}>
              <Bx pos={[x, y, d / 2 - 0.005]} size={[fw - 0.015, frente - 0.015, 0.02]} color="#9a6a3a" />
              <Bx pos={[x, y + frente / 2 - 0.01, d / 2 + 0.012]} size={[cajones ? fw * 0.3 : 0.02, cajones ? 0.02 : 0.12, 0.02]} color={ACERO} metal />
            </group>
          );
        }),
      )}
    </>
  );
};

const Closet: Modelo = ({ w, d, h }) => {
  const n = Math.max(2, Math.round(w / 0.6));
  const fw = (w - 0.04) / n;
  return (
    <>
      <Bx pos={[0, 0, 0]} size={[w, h, d - 0.02]} color="#e7e5e4" />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <Bx pos={[-w / 2 + 0.02 + fw * (i + 0.5), 0.03, d / 2 - 0.005]} size={[fw - 0.01, h - 0.06, 0.02]} color="#d6d3d1" r={0.005} />
          <Bx pos={[-w / 2 + 0.02 + fw * (i + (i % 2 ? 0.12 : 0.88)), h * 0.45, d / 2 + 0.015]} size={[0.02, 0.2, 0.02]} color={NEGRO} />
        </group>
      ))}
    </>
  );
};

const Cama: Modelo = ({ w, d, c }) => {
  const almohadas = w > 1.4 ? 2 : 1;
  return (
    <>
      <Bx pos={[0, 0.08, 0]} size={[w, 0.22, d]} color={MADERA_OSC} r={0.02} />
      <Bx pos={[0, 0.3, 0]} size={[w - 0.06, 0.2, d - 0.06]} color={BLANCO} r={0.06} />
      <Bx pos={[0, 0, -d / 2 + 0.03]} size={[w + 0.04, 1.0, 0.07]} color={MADERA} r={0.025} />
      {Array.from({ length: almohadas }, (_, i) => (
        <Bx key={i} pos={[-((almohadas - 1) * (w / almohadas)) / 2 + i * (w / almohadas), 0.5, -d / 2 + 0.32]} size={[w / almohadas - 0.16, 0.13, 0.42]} color="#fafaf9" r={0.06} />
      ))}
      <Bx pos={[0, 0.5, d * 0.14]} size={[w - 0.02, 0.07, d * 0.62]} color={c} r={0.04} />
      <Bx pos={[0, 0.5, d * 0.14 - d * 0.31 + 0.01]} size={[w - 0.02, 0.09, 0.1]} color={aclarar(c, 0.35)} r={0.04} />
    </>
  );
};

const Estufa: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w, h - 0.04, d]} color={ACERO} metal r={0.01} />
    <Bx pos={[0, h - 0.04, 0]} size={[w, 0.04, d]} color={NEGRO} r={0.008} />
    {[-1, 1].flatMap((a) =>
      [-1, 1].map((b) => (
        <Cy key={`${a}${b}`} pos={[a * w * 0.23, h, b * d * 0.2]} r={Math.min(0.09, w * 0.16)} h={0.02} color="#3f3f46" metal />
      )),
    )}
    <Bx pos={[0, 0.1, d / 2 - 0.005]} size={[w - 0.1, h * 0.55, 0.02]} color={NEGRO} r={0.01} />
    <Bx pos={[0, h * 0.55, d / 2 + 0.02]} size={[w - 0.18, 0.025, 0.03]} color={ACERO} metal />
    {[-0.3, -0.1, 0.1, 0.3].map((x) => (
      <Cy key={x} pos={[x * w, h - 0.12, d / 2 + 0.004]} r={0.018} h={0.025} color={NEGRO} rot={[Math.PI / 2, 0, 0]} centro />
    ))}
  </>
);

const Refri: Modelo = ({ w, d, h }) => {
  const arriba = h * 0.34;
  return (
    <>
      <Bx pos={[0, 0, 0]} size={[w, h, d - 0.04]} color="#e5e7eb" metal r={0.02} />
      <Bx pos={[0, h - arriba + 0.005, d / 2 - 0.045]} size={[w - 0.02, arriba - 0.01, 0.045]} color={ACERO} metal r={0.015} />
      <Bx pos={[0, 0.02, d / 2 - 0.045]} size={[w - 0.02, h - arriba - 0.03, 0.045]} color={ACERO} metal r={0.015} />
      {[[h - arriba + 0.1, 0.35], [h - arriba - 0.55, 0.5]].map(([y, alto], i) => (
        <Bx key={i} pos={[w / 2 - 0.09, Math.max(0.1, y as number), d / 2 + 0.005]} size={[0.025, alto as number, 0.03]} color="#6b7280" metal />
      ))}
    </>
  );
};

const Fregadero: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w - 0.02, h - 0.04, d - 0.02]} color={BLANCO} />
    <Bx pos={[0, h - 0.04, 0]} size={[w, 0.04, d]} color={PIEDRA} />
    <Bx pos={[-w * 0.12, h - 0.005, 0.02]} size={[w * 0.5, 0.012, d * 0.6]} color={ACERO} metal />
    <Bx pos={[-w * 0.12, h - 0.002, 0.02]} size={[w * 0.44, 0.008, d * 0.5]} color="#9ca3af" metal />
    <Cy pos={[-w * 0.12, h, -d * 0.3]} r={0.018} h={0.22} color={ACERO} metal />
    <Bx pos={[-w * 0.12, h + 0.2, -d * 0.2]} size={[0.025, 0.025, 0.2]} color={ACERO} metal />
    <Bx pos={[w * 0.28, 0.05, d / 2 - 0.005]} size={[w * 0.4, h - 0.1, 0.015]} color="#e7e5e4" />
    <Bx pos={[-w * 0.2, 0.05, d / 2 - 0.005]} size={[w * 0.4, h - 0.1, 0.015]} color="#d6d3d1" />
  </>
);

const Lavadora = ({ w, d, h, secadora = false }: M & { secadora?: boolean }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w, h, d]} color={BLANCO} r={0.025} />
    <Bx pos={[0, h - 0.12, d / 2 - 0.004]} size={[w - 0.04, 0.1, 0.012]} color="#e5e7eb" />
    <Cy pos={[-w * 0.3, h - 0.07, d / 2 + 0.006]} r={0.02} h={0.02} color={NEGRO} rot={[Math.PI / 2, 0, 0]} centro />
    <Cy pos={[0, h * 0.45, d / 2 + 0.002]} r={Math.min(w, h) * 0.34} h={0.03} color={ACERO} metal rot={[Math.PI / 2, 0, 0]} centro />
    <Cy pos={[0, h * 0.45, d / 2 + 0.014]} r={Math.min(w, h) * 0.27} h={0.03} color={secadora ? "#fcd34d" : "#1e3a5f"} opacity={0.85} rot={[Math.PI / 2, 0, 0]} centro />
  </>
);

const Lavavajillas: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w, h, d]} color={ACERO} metal r={0.01} />
    <Bx pos={[0, h - 0.1, d / 2 + 0.003]} size={[w - 0.04, 0.07, 0.01]} color={NEGRO} />
    <Bx pos={[0, h - 0.2, d / 2 + 0.02]} size={[w - 0.14, 0.025, 0.03]} color="#9ca3af" metal />
  </>
);

const Lavadero: Modelo = ({ w, d, h }) => (
  <>
    {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Bx key={`${a}${b}`} pos={[a * (w / 2 - 0.04), 0, b * (d / 2 - 0.04)]} size={[0.05, h * 0.55, 0.05]} color={ACERO} metal />))}
    <Bx pos={[0, h * 0.55, 0]} size={[w, h * 0.45, d]} color="#e7e5e4" r={0.02} />
    <Bx pos={[0.0, h - 0.02, 0.04]} size={[w * 0.5, 0.02, d * 0.6]} color="#a8a29e" />
    <Bx pos={[-w * 0.3, h * 0.55, -d / 2 + 0.01]} size={[w * 0.35, h * 0.45, 0.02]} color="#d6d3d1" />
    <Cy pos={[w * 0.3, h, -d * 0.3]} r={0.015} h={0.15} color={ACERO} metal />
  </>
);

const Tanque: Modelo = ({ w, h, c }) => (
  <>
    <Cy pos={[0, 0, 0]} r={w / 2} h={h * 0.92} color={c === "#0d9488" ? "#e7e5e4" : "#e5e7eb"} metal seg={28} />
    <Sp pos={[0, h * 0.92, 0]} r={w / 2} sy={0.18} color="#d1d5db" />
    <Cy pos={[0, 0, 0]} r={w / 2 + 0.005} h={0.05} color={NEGRO} seg={28} />
  </>
);

const Tinaco: Modelo = ({ w, h }) => (
  <>
    <Cy pos={[0, 0, 0]} r={w / 2} h={h * 0.88} color="#1f2937" seg={28} />
    <Sp pos={[0, h * 0.88, 0]} r={w / 2} sy={0.26} color="#374151" />
    <Cy pos={[0, h * 0.97, 0]} r={0.12} h={0.03} color="#9ca3af" />
  </>
);

const Wc: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, -d * 0.1]} size={[w * 0.6, h * 0.55, d * 0.5]} color={BLANCO} r={0.05} />
    <Bx pos={[0, h * 0.5, d * 0.1]} size={[w * 0.9, h * 0.38, d * 0.62]} color={BLANCO} r={0.12} />
    <Bx pos={[0, h * 0.86, d * 0.1]} size={[w * 0.78, 0.025, d * 0.52]} color="#f1f5f9" r={0.1} />
    <Bx pos={[0, h * 0.45, -d / 2 + 0.1]} size={[w * 0.9, h * 0.95 + 0.05, 0.18]} color={BLANCO} r={0.03} />
    <Cy pos={[w * 0.28, h * 1.5 - 0.05, -d / 2 + 0.1]} r={0.02} h={0.03} color={ACERO} metal />
  </>
);

const Lavabo: Modelo = ({ w, d, h }) => (
  <>
    <Cy pos={[0, 0, -d * 0.12]} r={0.08} h={h * 0.74} color={BLANCO} />
    <Bx pos={[0, h * 0.74, 0]} size={[w, h * 0.12, d]} color={BLANCO} r={0.06} />
    <Bx pos={[0, h * 0.86, 0.02]} size={[w * 0.72, 0.012, d * 0.6]} color="#e2e8f0" r={0.05} />
    <Cy pos={[0, h * 0.86, -d * 0.36]} r={0.014} h={0.12} color={ACERO} metal />
    <Bx pos={[0, h * 0.86 + 0.1, -d * 0.3]} size={[0.02, 0.02, 0.12]} color={ACERO} metal />
  </>
);

const Regadera: Modelo = ({ w, d }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w, 0.05, d]} color={BLANCO} />
    <Bx pos={[0, 0.05, d / 2 - 0.01]} size={[w, 1.9, 0.012]} color="#bae6fd" opacity={0.3} />
    <Bx pos={[w / 2 - 0.01, 0.05, 0]} size={[0.012, 1.9, d]} color="#bae6fd" opacity={0.3} />
    <Cy pos={[-w / 2 + 0.06, 0.05, -d / 2 + 0.06]} r={0.012} h={1.95} color={ACERO} metal />
    <Bx pos={[-w / 2 + 0.06, 1.95, -d / 2 + 0.14]} size={[0.02, 0.02, 0.16]} color={ACERO} metal />
    <Cy pos={[-w / 2 + 0.06, 1.93, -d / 2 + 0.22]} r={0.07} h={0.025} color={ACERO} metal />
  </>
);

const Tina: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w, h, d]} color={BLANCO} r={0.1} />
    <Bx pos={[0, h - 0.015, 0]} size={[w - 0.16, 0.02, d - 0.16]} color="#bae6fd" r={0.12} />
    <Cy pos={[-w / 2 + 0.12, h, 0]} r={0.014} h={0.18} color={ACERO} metal />
    <Bx pos={[-w / 2 + 0.12, h + 0.16, 0]} size={[0.14, 0.02, 0.02]} color={ACERO} metal rot={[0, 0, 0]} />
  </>
);

const Pantalla: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0.1, 0]} size={[w, h - 0.1, d]} color={NEGRO} r={0.01} />
    <Bx pos={[0, 0, 0]} size={[w * 0.3, 0.1, d + 0.2]} color="#52525b" />
  </>
);

const Auto: Modelo = ({ w, d, h, c }) => (
  <>
    <Bx pos={[0, 0.22, 0]} size={[w, h * 0.4, d]} color={c === "#57534e" ? "#1e40af" : c} r={0.18} />
    <Bx pos={[0, 0.22 + h * 0.36, -d * 0.04]} size={[w * 0.88, h * 0.34, d * 0.52]} color="#1e40af" r={0.12} />
    <Bx pos={[0, 0.22 + h * 0.4, -d * 0.04]} size={[w * 0.9, h * 0.22, d * 0.5]} color="#0f172a" opacity={0.85} r={0.06} />
    {[-1, 1].flatMap((a) =>
      [-1, 1].map((b) => <Cy key={`${a}${b}`} pos={[a * (w / 2 - 0.08), 0.32, b * d * 0.31]} r={0.32} h={0.24} color="#18181b" rot={[0, 0, Math.PI / 2]} centro />),
    )}
    {[-1, 1].map((a) => (
      <Bx key={a} pos={[a * (w / 2 - 0.2), 0.45, d / 2 - 0.01]} size={[0.28, 0.1, 0.03]} color="#fef9c3" />
    ))}
  </>
);

const Moto: Modelo = ({ w, d, h }) => (
  <>
    {[-1, 1].map((b) => (
      <Cy key={b} pos={[0, 0.3, b * (d / 2 - 0.32)]} r={0.3} h={0.12} color="#18181b" rot={[0, 0, Math.PI / 2]} centro />
    ))}
    <Bx pos={[0, 0.3, -d * 0.1]} size={[w * 0.45, 0.4, d * 0.5]} color="#b91c1c" r={0.08} />
    <Bx pos={[0, 0.7, -d * 0.12]} size={[w * 0.5, 0.1, d * 0.38]} color={NEGRO} r={0.05} />
    <Bx pos={[0, h * 0.78, d / 2 - 0.4]} size={[w, 0.04, 0.05]} color={NEGRO} />
    <Cy pos={[0, 0.28, d / 2 - 0.34]} r={0.02} h={0.55} color="#9ca3af" metal rot={[0.25, 0, 0]} />
  </>
);

const Alberca: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, 0]} size={[w - 0.1, h, d - 0.1]} color="#38bdf8" opacity={0.85} />
    {[[0, d / 2 - 0.07, w, 0.14], [0, -d / 2 + 0.07, w, 0.14], [w / 2 - 0.07, 0, 0.14, d - 0.28], [-w / 2 + 0.07, 0, 0.14, d - 0.28]].map(([x, z, sw, sd], i) => (
      <Bx key={i} pos={[x, 0, z]} size={[sw, h + 0.04, sd]} color="#e7e5e4" />
    ))}
  </>
);

const Asador: Modelo = ({ w, d, h }) => (
  <>
    {[-1, 1].map((l) => (
      <Bx key={l} pos={[l * (w / 2 - 0.05), 0, 0]} size={[0.04, h * 0.5, 0.04]} color={NEGRO} />
    ))}
    <Bx pos={[0, h * 0.45, 0]} size={[w, h * 0.22, d]} color="#3f3f46" r={0.03} />
    <Cy pos={[0, h * 0.67, 0]} r={d / 2} rTop={d / 2} h={w} color="#27272a" metal rot={[0, 0, Math.PI / 2]} centro seg={20} />
    <Bx pos={[w / 2 - 0.1, h * 0.8, 0]} size={[0.06, 0.2, 0.06]} color={NEGRO} />
    <Bx pos={[0, h * 0.35, d / 2 - 0.01]} size={[w * 0.8, 0.05, 0.03]} color="#a1a1aa" metal />
  </>
);

const Arbol: Modelo = ({ w, h }) => (
  <>
    <Cy pos={[0, 0, 0]} r={Math.max(0.06, w * 0.06)} rTop={Math.max(0.04, w * 0.04)} h={h * 0.5} color="#78350f" seg={10} />
    <Sp pos={[0, h * 0.68, 0]} r={w * 0.5} sy={0.9} color="#16a34a" />
    <Sp pos={[w * 0.2, h * 0.58, w * 0.12]} r={w * 0.32} color="#15803d" />
    <Sp pos={[-w * 0.18, h * 0.82, -w * 0.1]} r={w * 0.3} color="#22c55e" />
  </>
);

const Arbusto: Modelo = ({ w, h }) => (
  <>
    <Cy pos={[0, 0, 0]} r={w * 0.28} h={h * 0.18} color="#b45309" seg={16} />
    <Sp pos={[0, h * 0.5, 0]} r={w * 0.4} sy={0.9} color="#22c55e" />
    <Sp pos={[w * 0.18, h * 0.62, 0.05]} r={w * 0.25} color="#16a34a" />
    <Sp pos={[-w * 0.2, h * 0.58, -0.05]} r={w * 0.22} color="#4ade80" />
  </>
);

const Jardinera: Modelo = ({ w, d, h }) => {
  const n = Math.max(2, Math.round(w / 0.4));
  return (
    <>
      <Bx pos={[0, 0, 0]} size={[w, h * 0.75, d]} color="#c2410c" r={0.02} />
      <Bx pos={[0, h * 0.7, 0]} size={[w - 0.08, 0.05, d - 0.08]} color="#3f2d1e" />
      {Array.from({ length: n }, (_, i) => (
        <Sp key={i} pos={[-w / 2 + (w * (i + 0.5)) / n, h * 0.75 + 0.08, 0]} r={Math.min(d * 0.45, 0.18)} sy={0.85} color={i % 2 ? "#16a34a" : "#22c55e"} />
      ))}
    </>
  );
};

const Palapa: Modelo = ({ w, d, h }) => (
  <>
    {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Cy key={`${a}${b}`} pos={[a * (w / 2 - 0.1), 0, b * (d / 2 - 0.1)]} r={0.06} h={h * 0.78} color={MADERA_OSC} seg={10} />))}
    <Cy pos={[0, h * 0.78, 0]} r={Math.max(w, d) * 0.74} rTop={0.08} h={h * 0.22} color="#d6a76b" seg={4} rot={[0, Math.PI / 4, 0]} />
  </>
);

const Camastro: Modelo = ({ w, d, h, c }) => (
  <>
    {[-1, 1].map((l) => (
      <Bx key={l} pos={[l * (w / 2 - 0.03), 0, 0]} size={[0.04, h * 0.5, d]} color={ACERO} metal />
    ))}
    <Bx pos={[0, h * 0.5, d * 0.15]} size={[w - 0.04, 0.09, d * 0.55]} color={c} r={0.03} />
    <Bx pos={[0, h * 0.55, -d * 0.3]} size={[w - 0.04, 0.09, d * 0.4]} color={c} r={0.03} rot={[0.5, 0, 0]} />
  </>
);

const CalentadorSolar: Modelo = ({ w, d, h }) => (
  <>
    <Bx pos={[0, 0, d * 0.1]} size={[w, 0.18, 0.06]} color={ACERO} metal />
    <Bx pos={[0, 0.12, 0]} size={[w, 0.05, d]} color="#1e3a8a" rot={[0.35, 0, 0]} metal />
    <Cy pos={[0, h * 0.3 + 0.15, -d * 0.4]} r={0.12} h={w * 0.9} color={ACERO} metal rot={[0, 0, Math.PI / 2]} centro />
  </>
);

const Mostrador: Modelo = (m) => (
  <>
    <Gabinete {...m} h={m.h} topColor="#e7e5e4" bodyColor="#1f2937" />
    <Bx pos={[0, m.h - 0.02, -m.d * 0.25]} size={[m.w, 0.05, m.d * 0.55]} color="#d6d3d1" r={0.01} />
  </>
);

export const MODELOS_3D: Record<string, Modelo> = {
  sofa3: Sofa,
  sofa2: Sofa,
  sillon: Sofa,
  sillon_espera: Sofa,
  mesa_centro: MesaCentro,
  mueble_tv: MuebleTV,
  librero: (m) => <Repisas {...m} />,
  librero_of: (m) => <Repisas {...m} />,
  estante: (m) => <Repisas {...m} />,
  anaquel: (m) => <Repisas {...m} />,
  mueble_bano: (m) => <Repisas {...m} puertas />,
  estufa: Estufa,
  refri: Refri,
  fregadero: Fregadero,
  isla: (m) => <Gabinete {...m} topColor="#e7e5e4" bodyColor="#374151" />,
  barra: (m) => <Gabinete {...m} topColor={MADERA} bodyColor={MADERA_OSC} />,
  meson: (m) => <Gabinete {...m} />,
  lavavajillas: Lavavajillas,
  mesa4: MesaRect,
  mesa6: MesaRect,
  mesa_redonda: MesaRedonda,
  mesa_jardin: MesaRedonda,
  mesa_patio: MesaRedonda,
  mesa_terraza: MesaRedonda,
  mesa_juntas: MesaJuntas,
  silla: Silla,
  silla_ext: Silla,
  silla_oficina: SillaOficina,
  silla_of: SillaOficina,
  silla_juntas: SillaOficina,
  trinchador: (m) => <Gabinete {...m} topColor={MADERA} bodyColor="#6b3f1d" />,
  cama_matrimonial: Cama,
  cama_king: Cama,
  cama_individual: Cama,
  buro: (m) => <Gabinete {...m} cajones topColor={MADERA} />,
  closet: Closet,
  comoda: (m) => <Gabinete {...m} cajones topColor={MADERA} />,
  tocador: (m) => <Gabinete {...m} cajones topColor={MADERA} />,
  archivero: (m) => <Gabinete {...m} cajones topColor="#9ca3af" bodyColor="#6b7280" />,
  mostrador: Mostrador,
  wc: Wc,
  lavabo: Lavabo,
  regadera: Regadera,
  tina: Tina,
  lavadora: (m) => <Lavadora {...m} />,
  secadora: (m) => <Lavadora {...m} secadora />,
  lavadero: Lavadero,
  boiler: Tanque,
  tinaco: Tinaco,
  escritorio: Escritorio,
  escritorio_of: Escritorio,
  pantalla: Pantalla,
  auto: Auto,
  moto: Moto,
  bodega: (m) => <Repisas {...m} />,
  alberca: Alberca,
  asador: Asador,
  asador_p: Asador,
  arbol: Arbol,
  arbol_j: Arbol,
  arbusto: Arbusto,
  jardinera: Jardinera,
  jardinera_j: Jardinera,
  palapa: Palapa,
  camastro: Camastro,
  calentador_solar: CalentadorSolar,
};
