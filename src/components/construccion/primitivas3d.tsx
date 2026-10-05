import type { ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";

type V3 = [number, number, number];

type MatProps = { color: string; opacity?: number; metal?: boolean; rough?: number };
export const Mat = ({ color, opacity, metal, rough }: MatProps) => (
  <meshStandardMaterial color={color} transparent={opacity !== undefined && opacity < 1} opacity={opacity ?? 1} metalness={metal ? 0.7 : 0.05} roughness={rough ?? (metal ? 0.35 : 0.75)} />
);

type BxProps = MatProps & {
  /** Centro en x/z y BASE en y. */
  pos?: V3;
  size: V3;
  /** Radio de redondeo de las aristas (m). */
  r?: number;
  rot?: V3;
};

/** Caja con la base apoyada en `pos[1]` (y no el centro), para armar muebles de abajo hacia arriba. */
export function Bx({ pos = [0, 0, 0], size, r = 0, rot, ...mat }: BxProps) {
  const position: V3 = [pos[0], pos[1] + size[1] / 2, pos[2]];
  if (r > 0) {
    return (
      <RoundedBox args={size} radius={Math.min(r, size[0] / 2.2, size[1] / 2.2, size[2] / 2.2)} smoothness={3} position={position} rotation={rot}>
        <Mat {...mat} />
      </RoundedBox>
    );
  }
  return (
    <mesh position={position} rotation={rot}>
      <boxGeometry args={size} />
      <Mat {...mat} />
    </mesh>
  );
}

type CyProps = MatProps & { pos?: V3; r: number; h: number; seg?: number; rot?: V3; rTop?: number; centro?: boolean };
/** Cilindro con la base en `pos[1]` (o, con `centro`, con su centro en `pos`: para los que van girados, como ruedas). */
export function Cy({ pos = [0, 0, 0], r, rTop, h, seg = 24, rot, centro = false, ...mat }: CyProps) {
  return (
    <mesh position={[pos[0], pos[1] + (centro ? 0 : h / 2), pos[2]]} rotation={rot}>
      <cylinderGeometry args={[rTop ?? r, r, h, seg]} />
      <Mat {...mat} />
    </mesh>
  );
}

type SpProps = MatProps & { pos?: V3; r: number; sy?: number };
/** Esfera (o elipsoide con `sy`) con el centro en `pos`. */
export function Sp({ pos = [0, 0, 0], r, sy = 1, ...mat }: SpProps) {
  return (
    <mesh position={pos} scale={[1, sy, 1]}>
      <sphereGeometry args={[r, 20, 16]} />
      <Mat {...mat} />
    </mesh>
  );
}

export const Grupo = ({ children, pos = [0, 0, 0], rot }: { children: ReactNode; pos?: V3; rot?: V3 }) => (
  <group position={pos} rotation={rot}>
    {children}
  </group>
);
