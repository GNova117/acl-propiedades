import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { DoubleSide, Shape } from "three";
import { wallSegmentsFromPolygon, wallFacadeRects, type Point } from "../../lib/construccion/geometry";
import { objetoDef, zonaDe } from "../../lib/construccion/objetos";
import { esTipoExterior } from "../../lib/construccion/stats";
import { geometriaEscalera } from "../../lib/construccion/escaleras";
import { espejoDe } from "../../lib/construccion/aberturasMapa";
import type { Abertura, Habitacion, Objeto } from "../../lib/construccion/types";

const WALL_THICKNESS = 0.15;
/** Una zona al aire libre (patio, jardín…) solo lleva un bordillo, no muros. */
const BORDILLO_M = 0.3;

const PISO_3D: Record<string, string> = {
  exterior: "#bbf7d0",
  patio: "#d9f99d",
  jardin: "#86efac",
  azotea: "#e7e5e4",
  terraza: "#bae6fd",
};

/** Puerta de verdad: marco, hoja de madera y manija (ya no es solo un hueco en el muro). */
function Puerta({ ab }: { ab: Abertura }) {
  const j = 0.06; // grosor del marco
  const depth = WALL_THICKNESS + 0.03;
  const yBase = ab.altoDesdePisoM;
  const hojaAncho = Math.max(0.1, ab.anchoM - 2 * j);
  const hojaAlto = Math.max(0.1, ab.altoM - j);
  return (
    <group position={[ab.offsetM, 0, 0]}>
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[lado * (ab.anchoM / 2 - j / 2), yBase + ab.altoM / 2, 0]}>
          <boxGeometry args={[j, ab.altoM, depth]} />
          <meshStandardMaterial color="#5b3a1a" />
        </mesh>
      ))}
      <mesh position={[0, yBase + ab.altoM - j / 2, 0]}>
        <boxGeometry args={[ab.anchoM, j, depth]} />
        <meshStandardMaterial color="#5b3a1a" />
      </mesh>
      <mesh position={[0, yBase + hojaAlto / 2, 0]}>
        <boxGeometry args={[hojaAncho, hojaAlto, 0.045]} />
        <meshStandardMaterial color="#b4793a" />
      </mesh>
      {[1, -1].map((cara) => (
        <mesh key={cara} position={[hojaAncho / 2 - 0.1, yBase + Math.min(1.0, hojaAlto / 2), cara * 0.05]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** Ventana de verdad: marco, vidrio translúcido, travesaños y repisa. */
function Ventana({ ab }: { ab: Abertura }) {
  const j = 0.05;
  const depth = WALL_THICKNESS + 0.02;
  const yBase = ab.altoDesdePisoM;
  const vidrioAncho = Math.max(0.05, ab.anchoM - 2 * j);
  const vidrioAlto = Math.max(0.05, ab.altoM - 2 * j);
  const marco = "#e5e7eb";
  return (
    <group position={[ab.offsetM, 0, 0]}>
      {[-1, 1].map((lado) => (
        <mesh key={`v${lado}`} position={[lado * (ab.anchoM / 2 - j / 2), yBase + ab.altoM / 2, 0]}>
          <boxGeometry args={[j, ab.altoM, depth]} />
          <meshStandardMaterial color={marco} />
        </mesh>
      ))}
      {[0, 1].map((arriba) => (
        <mesh key={`h${arriba}`} position={[0, yBase + (arriba ? ab.altoM - j / 2 : j / 2), 0]}>
          <boxGeometry args={[ab.anchoM, j, depth]} />
          <meshStandardMaterial color={marco} />
        </mesh>
      ))}
      <mesh position={[0, yBase + ab.altoM / 2, 0]}>
        <boxGeometry args={[0.03, vidrioAlto, depth * 0.8]} />
        <meshStandardMaterial color={marco} />
      </mesh>
      <mesh position={[0, yBase + ab.altoM / 2, 0]}>
        <boxGeometry args={[vidrioAncho, vidrioAlto, 0.012]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, yBase - 0.02, 0.04]}>
        <boxGeometry args={[ab.anchoM + 0.12, 0.04, WALL_THICKNESS + 0.1]} />
        <meshStandardMaterial color="#d4d4d8" />
      </mesh>
    </group>
  );
}

function Walls({ habitacion, omitir }: { habitacion: Habitacion; omitir: Set<string> }) {
  const segments = wallSegmentsFromPolygon(habitacion.puntos);
  const bajo = esTipoExterior(habitacion.tipo);
  const alto = bajo ? Math.min(BORDILLO_M, habitacion.alturaM) : habitacion.alturaM;
  return (
    <>
      {segments.map((segment, i) => {
        const openings = bajo ? [] : habitacion.aberturas.filter((a) => a.segmentIndex === i);
        const rects = wallFacadeRects(segment.length, alto, openings);
        return (
          <group key={i} position={[segment.start.x, 0, segment.start.z]} rotation={[0, -segment.angle, 0]}>
            {rects.map((r, j) => (
              <mesh key={j} position={[(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0]}>
                <boxGeometry args={[r.x1 - r.x0, r.y1 - r.y0, bajo ? 0.08 : WALL_THICKNESS]} />
                <meshStandardMaterial color={bajo ? "#a8a29e" : "#d4d4d8"} />
              </mesh>
            ))}
            {openings.filter((a) => !omitir.has(a.id)).map((a) => (a.tipo === "puerta" ? <Puerta key={a.id} ab={a} /> : <Ventana key={a.id} ab={a} />))}
          </group>
        );
      })}
    </>
  );
}

function Floor({ points, color }: { points: Point[]; color: string }) {
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) s.lineTo(points[i].x, points[i].z);
    s.closePath();
    return s;
  }, [points]);

  // rotation.x = +90° mapea el plano local (x, y) del shape a (x, 0, z) del mundo, sin espejear.
  return (
    <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} side={DoubleSide} />
    </mesh>
  );
}

function Escalera({ o, tipo, alto, elevacion }: { o: Objeto; tipo: "escalera_recta" | "escalera_L" | "escalera_caracol"; alto: number; elevacion: number }) {
  const geo = useMemo(() => geometriaEscalera(tipo, o.anchoM, o.largoM, alto), [tipo, o.anchoM, o.largoM, alto]);
  return (
    <group position={[o.x, elevacion + 0.02, o.z]} rotation={[0, (-o.rotDeg * Math.PI) / 180, 0]}>
      {geo.pasos.map((p, i) => (
        <mesh key={i} position={[p.x, p.top / 2, p.z]} rotation={[0, p.rot ?? 0, 0]}>
          <boxGeometry args={[p.w, p.top, p.d]} />
          <meshStandardMaterial color={i % 2 ? "#d6a76b" : "#c8965a"} />
        </mesh>
      ))}
      {geo.poste && (
        <mesh position={[0, alto / 2, 0]}>
          <cylinderGeometry args={[geo.poste, geo.poste, alto, 16]} />
          <meshStandardMaterial color="#78716c" />
        </mesh>
      )}
    </group>
  );
}

function Muebles({ objetos, elevacionDe, alturaDe }: { objetos: Objeto[]; elevacionDe: (o: Objeto) => number; alturaDe: (o: Objeto) => number | undefined }) {
  return (
    <>
      {objetos.map((o) => {
        const def = objetoDef(o.tipo);
        if (def?.tipoEspecial) return <Escalera key={o.id} o={o} tipo={def.tipoEspecial} alto={alturaDe(o) ?? def.altoM} elevacion={elevacionDe(o)} />;
        const alto = def?.altoM ?? 0.8;
        const color = zonaDe(def?.categoria).color;
        return (
          <mesh key={o.id} position={[o.x, elevacionDe(o) + alto / 2 + 0.02, o.z]} rotation={[0, (-o.rotDeg * Math.PI) / 180, 0]}>
            {def?.forma === "round" ? (
              <cylinderGeometry args={[o.anchoM / 2, o.anchoM / 2, alto, 24]} />
            ) : (
              <boxGeometry args={[o.anchoM, alto, o.largoM]} />
            )}
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}

type Props = {
  /** Una habitación (vista de cuarto), las de un nivel (plano completo) o todas (edificio completo). */
  habitaciones: Habitacion[];
  objetos: Objeto[];
  /**
   * Altura (m) a la que empieza cada nivel — omitido en la vista de un solo nivel, donde todo va a 0.
   * En "edificio completo" cada habitación/objeto se dibuja en el piso de su propio nivel (ver
   * `elevacionesPorNivel` en niveles.ts), para que los pisos queden apilados de verdad y no encimados.
   */
  elevacionPorNivel?: Record<string, number>;
};

export default function RoomPreview({ habitaciones, objetos, elevacionPorNivel }: Props) {
  const cerradas = habitaciones.filter((h) => h.puntos.length >= 3);
  if (cerradas.length === 0) {
    return (
      <div className="construccion-3d-empty">Cierra una habitación en el plano 2D para ver su render 3D.</div>
    );
  }

  const elevacion = (nivelId: string) => elevacionPorNivel?.[nivelId] ?? 0;
  const habitacionPorId = new Map(cerradas.map((h) => [h.id, h]));
  const elevacionDeObjeto = (o: Objeto) => {
    const suHabitacion = o.habitacionId ? habitacionPorId.get(o.habitacionId) : undefined;
    return elevacion(suHabitacion ? suHabitacion.nivelId : o.nivelId);
  };

  const alturaDeObjeto = (o: Objeto) => (o.habitacionId ? habitacionPorId.get(o.habitacionId)?.alturaM : undefined);
  // Una puerta compartida entre dos zonas existe una vez por lado: solo se dibuja una hoja.
  const omitir = new Set<string>();
  for (const h of cerradas) for (const a of h.aberturas) {
    const e = espejoDe(cerradas, h.id, a.id);
    if (e && e.ab.id < a.id) omitir.add(a.id);
  }

  const todos = cerradas.flatMap((h) => h.puntos);
  const center = todos.reduce((acc, p) => ({ x: acc.x + p.x / todos.length, z: acc.z + p.z / todos.length }), { x: 0, z: 0 });
  // Alto real de la cámara: la azotea del nivel más alto, no solo la altura de un cuarto — así un
  // edificio de 3 pisos no sale con la cámara metida dentro de la planta baja.
  const alturaTotal = Math.max(...cerradas.map((h) => elevacion(h.nivelId) + h.alturaM), 3);
  const extent = Math.max(
    ...todos.map((p) => Math.hypot(p.x - center.x, p.z - center.z)),
    3,
  );

  return (
    <Canvas className="construccion-3d-canvas">
      <PerspectiveCamera makeDefault position={[center.x + extent, alturaTotal + extent, center.z + extent]} fov={50} />
      <OrbitControls target={[center.x, alturaTotal / 2, center.z]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[center.x + 5, alturaTotal + 8, center.z + 3]} intensity={Math.PI} />
      {cerradas.map((h) => (
        <group key={h.id} position={[0, elevacion(h.nivelId), 0]}>
          <Walls habitacion={h} omitir={omitir} />
          <Floor points={h.puntos} color={PISO_3D[h.tipo ?? ""] ?? zonaDe(h.tipo).fill} />
        </group>
      ))}
      <Muebles objetos={objetos} elevacionDe={elevacionDeObjeto} alturaDe={alturaDeObjeto} />
      <Grid infiniteGrid sectionColor="#a1a1aa" cellColor="#e4e4e7" fadeDistance={40} />
    </Canvas>
  );
}
