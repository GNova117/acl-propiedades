import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { DoubleSide, Shape } from "three";
import { wallSegmentsFromPolygon, wallFacadeRects, type Point } from "../../lib/construccion/geometry";
import type { Habitacion } from "../../lib/construccion/types";

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

function Floor({ points }: { points: Point[] }) {
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
      <meshStandardMaterial color="#e4e4e7" side={DoubleSide} />
    </mesh>
  );
}

type Props = {
  habitacion: Habitacion | null;
};

export default function RoomPreview({ habitacion }: Props) {
  if (!habitacion || habitacion.puntos.length < 3) {
    return (
      <div className="construccion-3d-empty">Cierra una habitación en el plano 2D para ver su render 3D.</div>
    );
  }

  const { puntos, alturaM } = habitacion;
  const center = puntos.reduce(
    (acc, p) => ({ x: acc.x + p.x / puntos.length, z: acc.z + p.z / puntos.length }),
    { x: 0, z: 0 },
  );

  return (
    <Canvas className="construccion-3d-canvas">
      <PerspectiveCamera makeDefault position={[center.x + 5, alturaM + 3, center.z + 5]} fov={50} />
      <OrbitControls target={[center.x, alturaM / 2, center.z]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[center.x + 5, 8, center.z + 3]} intensity={Math.PI} />
      <Walls habitacion={habitacion} />
      <Floor points={puntos} />
      <Grid infiniteGrid sectionColor="#a1a1aa" cellColor="#e4e4e7" fadeDistance={30} />
    </Canvas>
  );
}
