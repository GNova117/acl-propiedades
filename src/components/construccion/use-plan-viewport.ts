import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Bounds, Point } from "../../lib/construccion/geometry";

/**
 * Zoom y desplazamiento del plano (reemplaza el lienzo fijo de 12×9 m). La vista se guarda como
 * centro + ancho en metros; el alto sale de la proporción real del contenedor, así el <svg> nunca
 * deja franjas vacías y la cuenta "punto bajo el cursor" es exacta.
 */
export type View = { cx: number; cz: number; w: number };

const MIN_W = 1.5;
const MAX_W = 250;
const FIT_MIN_W = 6;
const FIT_MARGIN_M = 1;
const PAN_THRESHOLD_PX = 5;
// Tras cambiar de cuarto/modo el diseño de la pantalla todavía se está acomodando (aparece el panel de
// medidas, etc.): durante este lapso un cambio de tamaño re-ajusta la vista. Después NO, para que el
// plano no se mueva bajo el cursor a media figura.
const REFIT_WINDOW_MS = 800;
export const DEFAULT_BOX: Bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 9 };

/** Separación de la cuadrícula (m) según cuánto plano se ve: más zoom, líneas más finas. */
export function gridStep(visibleWidthM: number): number {
  if (visibleWidthM > 120) return 20;
  if (visibleWidthM > 60) return 10;
  if (visibleWidthM > 28) return 5;
  if (visibleWidthM > 14) return 2;
  if (visibleWidthM > 6) return 1;
  return 0.5;
}

const clampW = (w: number) => Math.min(MAX_W, Math.max(MIN_W, w));

export function fitView(box: Bounds, aspect: number): View {
  const bw = box.maxX - box.minX + FIT_MARGIN_M * 2;
  const bh = box.maxZ - box.minZ + FIT_MARGIN_M * 2;
  return {
    cx: (box.minX + box.maxX) / 2,
    cz: (box.minZ + box.maxZ) / 2,
    w: clampW(Math.max(FIT_MIN_W, bw, bh / Math.max(aspect, 0.1))),
  };
}

type PointerInfo = { x: number; y: number };

export function usePlanViewport({ box, resetKey }: { box: Bounds | null; resetKey: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const aspect = size.h / size.w;
  const boxRef = useRef(box);
  boxRef.current = box;
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  // La vista solo se re-ajusta sola cuando cambia `resetKey` (otro cuarto, otro modo) y, justo después,
  // si el contenedor cambia de tamaño mientras nadie haya hecho zoom/desplazamiento (`pristine`).
  // Mientras se edita NO sigue al contenido: si lo hiciera, arrastrar un vértice movería el lienzo bajo
  // el cursor.
  const [state, setState] = useState<{ key: string; view: View; pristine: boolean }>(() => ({
    key: resetKey,
    view: fitView(box ?? DEFAULT_BOX, 0.75),
    pristine: true,
  }));
  if (state.key !== resetKey) setState({ key: resetKey, view: fitView(box ?? DEFAULT_BOX, aspect), pristine: true });
  const view = state.view;
  const viewRef = useRef(view);
  viewRef.current = view;

  const resetAt = useRef(0);
  useEffect(() => {
    resetAt.current = Date.now();
  }, [resetKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      const oldAspect = aspectRef.current;
      const newAspect = height / width;
      setSize({ w: width, h: height });
      setState((s) => {
        // El ajuste inicial supuso una proporción 4:3: se corrige con la medida real, y de nuevo si el
        // contenedor cambia de forma justo después de cambiar de cuarto (sin que nadie haya tocado la vista).
        if (s.pristine && Date.now() - resetAt.current < REFIT_WINDOW_MS) {
          return { ...s, view: fitView(boxRef.current ?? DEFAULT_BOX, newAspect) };
        }
        // Después: la esquina superior izquierda del plano no se mueve (solo se gana o se pierde espacio abajo).
        return { ...s, view: { ...s.view, cz: s.view.cz + (s.view.w * (newAspect - oldAspect)) / 2 } };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = view.w * aspect;
  const visible: Bounds = { minX: view.cx - view.w / 2, maxX: view.cx + view.w / 2, minZ: view.cz - h / 2, maxZ: view.cz + h / 2 };
  const mpp = view.w / size.w; // metros por píxel de pantalla

  // Toda operación del usuario (zoom, desplazar, ajustar, ensanchar) deja de ser "pristine".
  const setView = useCallback((fn: (v: View) => View) => {
    setState((s) => ({ key: s.key, view: fn(s.view), pristine: false }));
  }, []);

  /** Punto del plano (m) bajo una posición de pantalla, con la vista dada. */
  const planAt = useCallback((clientX: number, clientY: number, v: View): Point => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: v.cx, z: v.cz };
    const vh = v.w * (rect.height / rect.width);
    return {
      x: v.cx + ((clientX - rect.left) / rect.width - 0.5) * v.w,
      z: v.cz + ((clientY - rect.top) / rect.height - 0.5) * vh,
    };
  }, []);

  const zoomAt = useCallback(
    (factor: number, px: number, pz: number) =>
      setView((v) => {
        const w = clampW(v.w * factor);
        const f = w / v.w;
        return { w, cx: px - (px - v.cx) * f, cz: pz - (pz - v.cz) * f };
      }),
    [setView],
  );

  const zoomIn = () => zoomAt(1 / 1.4, viewRef.current.cx, viewRef.current.cz);
  const zoomOut = () => zoomAt(1.4, viewRef.current.cx, viewRef.current.cz);
  const fit = () => setState((s) => ({ key: s.key, view: fitView(boxRef.current ?? DEFAULT_BOX, aspectRef.current), pristine: true }));

  /** Si algún punto cae fuera de la vista (p. ej. al dibujar por medidas), ensancha la vista para incluirlo. */
  const ensureVisible = (points: Point[]) => {
    if (points.length === 0) return;
    setView((v) => {
      const vh = v.w * aspectRef.current;
      const minX = v.cx - v.w / 2, maxX = v.cx + v.w / 2, minZ = v.cz - vh / 2, maxZ = v.cz + vh / 2;
      const m = Math.max(FIT_MARGIN_M, v.w * 0.05);
      const inside = points.every((p) => p.x >= minX + m && p.x <= maxX - m && p.z >= minZ + m && p.z <= maxZ - m);
      if (inside) return v;
      return fitView(
        {
          minX: Math.min(minX + m, ...points.map((p) => p.x)),
          maxX: Math.max(maxX - m, ...points.map((p) => p.x)),
          minZ: Math.min(minZ + m, ...points.map((p) => p.z)),
          maxZ: Math.max(maxZ - m, ...points.map((p) => p.z)),
        },
        aspectRef.current,
      );
    });
  };

  // Rueda del mouse / pellizco del trackpad: listener nativo no pasivo para poder evitar que la página se desplace.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const factor = Math.exp(e.deltaY * unit * 0.0015);
      const p = planAt(e.clientX, e.clientY, viewRef.current);
      zoomAt(factor, p.x, p.z);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [planAt, zoomAt]);

  // --- Desplazar (un dedo / mouse sobre el fondo) y pellizcar (dos dedos) ---
  const pointers = useRef(new Map<number, PointerInfo>());
  const gesture = useRef<{ start: View; startPointer: PointerInfo; startDist: number; startMid: PointerInfo; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { start: viewRef.current, startPointer: pts[0], startDist: 0, startMid: pts[0], moved: false };
    } else if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = {
        start: viewRef.current,
        startPointer: a,
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        moved: true,
      };
      suppressClick.current = true;
    }
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return; // movimiento de un arrastre de objeto/vértice, no de la vista
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!g || !rect) return;
    const pts = [...pointers.current.values()];

    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = clampW(g.start.w * (g.startDist / dist));
      const anchor = planAt(g.startMid.x, g.startMid.y, g.start); // el punto del plano que estaba entre los dedos
      const vh = w * (rect.height / rect.width);
      setView(() => ({
        w,
        cx: anchor.x - ((mid.x - rect.left) / rect.width - 0.5) * w,
        cz: anchor.z - ((mid.y - rect.top) / rect.height - 0.5) * vh,
      }));
      return;
    }

    const dx = e.clientX - g.startPointer.x;
    const dy = e.clientY - g.startPointer.y;
    if (!g.moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
    if (!g.moved) {
      g.moved = true;
      suppressClick.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura el desplazamiento funciona igual mientras el cursor siga dentro */
      }
    }
    const perPx = g.start.w / rect.width;
    setView(() => ({ w: g.start.w, cx: g.start.cx - dx * perPx, cz: g.start.cz - dy * perPx }));
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      // El `click` llega justo después del pointerup: la bandera se limpia después de él.
      if (suppressClick.current) setTimeout(() => (suppressClick.current = false), 0);
    } else if (pointers.current.size === 1) {
      // Quedó un dedo: reinicia el desplazamiento desde donde está, sin saltos.
      const [only] = [...pointers.current.values()];
      gesture.current = { start: viewRef.current, startPointer: only, startDist: 0, startMid: only, moved: true };
    }
  }

  /** true si el `click` que sigue debe ignorarse porque en realidad fue un desplazamiento o pellizco. */
  function consumeClick(): boolean {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }

  return {
    wrapRef,
    view,
    visible,
    mpp,
    viewBox: `${visible.minX} ${visible.minZ} ${view.w} ${h}`,
    zoomIn,
    zoomOut,
    fit,
    ensureVisible,
    consumeClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

export type PlanViewport = ReturnType<typeof usePlanViewport>;
