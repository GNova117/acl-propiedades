import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { DoubleSide, Path, Shape } from "three";
import { pointInPolygon, wallSegmentsFromPolygon, wallFacadeRects, type Point } from "../../lib/construccion/geometry";
import { objetoDef, zonaDe } from "../../lib/construccion/objetos";
import { acabadoDe } from "../../lib/construccion/acabados";
import { Techo, planearTechos } from "./techos3d";
import Caminante from "./recorrido3d";
import { esTipoExterior } from "../../lib/construccion/stats";
import { geometriaEscalera } from "../../lib/construccion/escaleras";
import { espejoDe } from "../../lib/construccion/aberturasMapa";
import { Puerta3D, Ventana3D } from "./aberturas3d";
import { MODELOS_3D } from "./muebles3d";
import { RoundedBox } from "@react-three/drei";
import type { ConexionEscalera } from "../../lib/construccion/conexiones";
import type { Habitacion, Objeto } from "../../lib/construccion/types";

const WALL_THICKNESS = 0.15;
/** Una zona al aire libre (patio, jardín…) solo lleva un bordillo, no muros. */
const BORDILLO_M = 0.3;

const PISO_3D: Record<string, string> = {
  exterior: "#bbf7d0",
  patio: "#d9f99d",
  jardin: "#86efac",
  azotea: "#e7e5e4",
  terraza: "#bae6fd",
  terreno: "#d1fae5",
};

function Walls({ habitacion, omitir }: { habitacion: Habitacion; omitir: Set<string> }) {
  const segments = wallSegmentsFromPolygon(habitacion.puntos);
  const bajo = esTipoExterior(habitacion.tipo);
  const alto = bajo ? Math.min(BORDILLO_M, habitacion.alturaM) : habitacion.alturaM;
  const colorMuro = acabadoDe("pared", habitacion.acabados?.pared)?.color ?? "#d4d4d8";
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
                <meshStandardMaterial color={bajo ? "#a8a29e" : colorMuro} />
              </mesh>
            ))}
            {openings.filter((a) => !omitir.has(a.id)).map((a) => (a.tipo === "puerta" ? <Puerta3D key={a.id} ab={a} /> : <Ventana3D key={a.id} ab={a} />))}
          </group>
        );
      })}
    </>
  );
}

function Floor({ points, color, huecos = [], y = 0.01 }: { points: Point[]; color: string; huecos?: Point[][]; y?: number }) {
  const llave = JSON.stringify(huecos);
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) s.lineTo(points[i].x, points[i].z);
    s.closePath();
    // Huecos de escalera: el piso se corta donde sube la escalera del nivel de abajo.
    for (const h of JSON.parse(llave) as Point[][]) {
      const path = new Path();
      path.moveTo(h[0].x, h[0].z);
      for (let i = 1; i < h.length; i++) path.lineTo(h[i].x, h[i].z);
      path.closePath();
      s.holes.push(path);
    }
    return s;
  }, [points, llave]);

  // rotation.x = +90° mapea el plano local (x, y) del shape a (x, 0, z) del mundo, sin espejear.
  return (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
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
        const Modelo = MODELOS_3D[o.tipo];
        if (Modelo) {
          // Instalaciones: de pared van a su altura de montaje; las de techo cuelgan del cielo de su zona.
          const yMontaje = def?.montaje === "techo" ? (alturaDe(o) ?? 2.5) - alto - 0.02 : def?.montaje === "pared" ? (def.montajeY ?? 0) - 0.02 : 0;
          return (
            <group key={o.id} position={[o.x, elevacionDe(o) + 0.02 + yMontaje, o.z]} rotation={[0, (-o.rotDeg * Math.PI) / 180, 0]}>
              <Modelo w={o.anchoM} d={o.largoM} h={alto} c={color} />
            </group>
          );
        }
        // Sin modelo propio: bloque con las aristas suavizadas (cilindro si es redondo).
        return (
          <group key={o.id} position={[o.x, elevacionDe(o) + 0.02, o.z]} rotation={[0, (-o.rotDeg * Math.PI) / 180, 0]}>
            {def?.forma === "round" ? (
              <mesh position={[0, alto / 2, 0]}>
                <cylinderGeometry args={[o.anchoM / 2, o.anchoM / 2, alto, 24]} />
                <meshStandardMaterial color={color} />
              </mesh>
            ) : (
              <RoundedBox args={[o.anchoM, alto, o.largoM]} radius={Math.min(0.04, alto / 3, o.anchoM / 3, o.largoM / 3)} smoothness={3} position={[0, alto / 2, 0]}>
                <meshStandardMaterial color={color} />
              </RoundedBox>
            )}
          </group>
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
  /** Escaleras que unen niveles: fijan el desnivel que salvan y el hueco en el piso de arriba. */
  conexiones?: ConexionEscalera[];
  /** Dibuja los techos (losa o de dos/cuatro aguas) para ver el edificio cerrado, por fuera. */
  techos?: boolean;
  /** Recorrido en primera persona: arranca en este punto del nivel indicado. */
  caminar?: { x: number; z: number; nivelId: string } | null;
};

export default function RoomPreview({ habitaciones, objetos, elevacionPorNivel, conexiones = [], techos = false, caminar = null }: Props) {
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

  // Una escalera que une dos niveles salva exactamente el desnivel entre sus pisos; si no, la altura de su zona.
  const alturaDeObjeto = (o: Objeto) => conexiones.find((c) => c.objetoId === o.id)?.riseM ?? (o.habitacionId ? habitacionPorId.get(o.habitacionId)?.alturaM : undefined);
  const huecosDe = (h: Habitacion) =>
    conexiones.filter((c) => c.nivelDestinoId === h.nivelId && c.hueco.every((pt) => pointInPolygon(pt, h.puntos))).map((c) => c.hueco);
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

  const techosPlaneados = techos ? planearTechos(cerradas, elevacion) : [];

  return (
    <Canvas className="construccion-3d-canvas">
      {caminar ? (
        <>
          <PerspectiveCamera makeDefault position={[caminar.x, elevacion(caminar.nivelId) + 1.6, caminar.z]} fov={72} near={0.05} />
          <Caminante habitaciones={cerradas} objetos={objetos} conexiones={conexiones} elevacion={elevacion} inicio={caminar} />
        </>
      ) : (
        <>
          <PerspectiveCamera makeDefault position={[center.x + extent, alturaTotal + extent, center.z + extent]} fov={50} />
          <OrbitControls target={[center.x, alturaTotal / 2, center.z]} />
        </>
      )}
      <ambientLight intensity={1.5} />
      <directionalLight position={[center.x + 5, alturaTotal + 8, center.z + 3]} intensity={Math.PI} />
      {cerradas.map((h) => (
        <group key={h.id} position={[0, elevacion(h.nivelId), 0]}>
          {h.tipo !== "terreno" && <Walls habitacion={h} omitir={omitir} />}
          <Floor
            points={h.puntos}
            color={acabadoDe("piso", h.acabados?.piso)?.color ?? PISO_3D[h.tipo ?? ""] ?? zonaDe(h.tipo).fill}
            huecos={huecosDe(h)}
            y={h.tipo === "terreno" ? -0.015 : 0.01}
          />
        </group>
      ))}
      {techosPlaneados.map((t) => (
        <Techo key={t.key} spec={t} />
      ))}
      <Muebles objetos={objetos} elevacionDe={elevacionDeObjeto} alturaDe={alturaDeObjeto} />
      <Grid infiniteGrid sectionColor="#a1a1aa" cellColor="#e4e4e7" fadeDistance={40} />
    </Canvas>
  );
}
