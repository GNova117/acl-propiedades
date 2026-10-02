import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { DoubleSide, Shape } from "three";
import { wallSegmentsFromPolygon, wallFacadeRects, type Point } from "../../lib/construccion/geometry";
import { objetoDef, zonaDe } from "../../lib/construccion/objetos";
import type { Habitacion, Objeto } from "../../lib/construccion/types";

const WALL_THICKNESS = 0.15;

function Walls({ habitacion }: { habitacion: Habitacion }) {
  const segments = wallSegmentsFromPolygon(habitacion.puntos);
  return (
    <>
      {segments.map((segment, i) => {
        const openings = habitacion.aberturas.filter((a) => a.segmentIndex === i);
        const rects = wallFacadeRects(segment.length, habitacion.alturaM, openings);
        return (
          <group key={i} position={[segment.start.x, 0, segment.start.z]} rotation={[0, -segment.angle, 0]}>
            {rects.map((r, j) => (
              <mesh key={j} position={[(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0]}>
                <boxGeometry args={[r.x1 - r.x0, r.y1 - r.y0, WALL_THICKNESS]} />
                <meshStandardMaterial color="#d4d4d8" />
              </mesh>
            ))}
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

function Muebles({ objetos, elevacionDe }: { objetos: Objeto[]; elevacionDe: (o: Objeto) => number }) {
  return (
    <>
      {objetos.map((o) => {
        const def = objetoDef(o.tipo);
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
          <Walls habitacion={h} />
          <Floor points={h.puntos} color={zonaDe(h.tipo).fill} />
        </group>
      ))}
      <Muebles objetos={objetos} elevacionDe={elevacionDeObjeto} />
      <Grid infiniteGrid sectionColor="#a1a1aa" cellColor="#e4e4e7" fadeDistance={40} />
    </Canvas>
  );
}
