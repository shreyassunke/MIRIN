import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import * as THREE from "three";
import {
  acquireCanvas,
  cancelFrames,
  configureSize,
  createInstrumentScene,
  releaseCanvas,
  renderNow,
  requestFrames,
  type FrameFn,
} from "./stage";
import { fitOrthoCamera } from "./scale";

const PITCH_MAX = THREE.MathUtils.degToRad(80);
/** Movement below this is a tap. Past it, vertical intent scrolls the page; horizontal intent orbits. */
export const TAP_PX = 12;

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type AttachFn = (pivot: THREE.Group) => () => void;

type DragStart = {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  pointerId: number;
  captured: boolean;
  discarded: boolean;
};

export function useWeightStage(opts: {
  attach: AttachFn;
  extraFrame?: FrameFn;
  onTap?: (ndc: THREE.Vector2, camera: THREE.Camera) => void;
  padding?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const drag = useRef<DragStart | null>(null);
  const attachRef = useRef(opts.attach);
  const extraRef = useRef(opts.extraFrame);
  const tapRef = useRef(opts.onTap);
  const padding = opts.padding ?? 1.15;
  attachRef.current = opts.attach;
  extraRef.current = opts.extraFrame;
  tapRef.current = opts.onTap;

  const requestRender = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    renderNow(scene, camera);
  }, []);

  const fit = useCallback(() => {
    const camera = cameraRef.current;
    const pivot = pivotRef.current;
    const host = hostRef.current;
    if (!camera || !pivot || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;
    configureSize(w, h);
    const rot = pivot.rotation.clone();
    pivot.rotation.set(0, 0, 0);
    pivot.updateWorldMatrix(true, true);
    fitOrthoCamera(camera, pivot, w, h, padding);
    pivot.rotation.copy(rot);
    requestRender();
  }, [padding, requestRender]);

  const spring: FrameFn = useCallback(
    (now) => {
      const extra = extraRef.current?.(now) ?? false;
      if (prefersReducedMotion()) {
        yaw.current = 0;
        pitch.current = 0;
        targetYaw.current = 0;
        targetPitch.current = 0;
      } else {
        yaw.current += (targetYaw.current - yaw.current) * 0.28;
        pitch.current += (targetPitch.current - pitch.current) * 0.28;
      }
      const pivot = pivotRef.current;
      if (pivot) pivot.rotation.set(pitch.current, yaw.current, 0);
      requestRender();
      const settling =
        !prefersReducedMotion() &&
        (Math.abs(targetYaw.current - yaw.current) > 0.0004 ||
          Math.abs(targetPitch.current - pitch.current) > 0.0004);
      return extra || settling || !!drag.current;
    },
    [requestRender],
  );

  const kick = useCallback(() => {
    requestFrames(spring);
  }, [spring]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = acquireCanvas(host);
    canvasRef.current = canvas;

    const scene = createInstrumentScene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    const pivot = new THREE.Group();
    scene.add(pivot);

    sceneRef.current = scene;
    cameraRef.current = camera;
    pivotRef.current = pivot;

    const detach = attachRef.current(pivot);
    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(host);
    kick();

    return () => {
      cancelFrames(spring);
      ro.disconnect();
      detach();
      releaseCanvas(host);
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      pivotRef.current = null;
      canvasRef.current = null;
    };
  }, [fit, kick, spring]);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      yaw: targetYaw.current,
      pitch: targetPitch.current,
      pointerId: e.pointerId,
      captured: false,
      discarded: false,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const start = drag.current;
    if (!start || start.discarded) return;
    const host = hostRef.current;
    if (!host) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.captured) {
      if (Math.hypot(dx, dy) <= TAP_PX) return;
      // Vertical intent belongs to the page. Do not capture.
      if (Math.abs(dy) >= Math.abs(dx) || prefersReducedMotion()) {
        start.discarded = true;
        return;
      }
      start.captured = true;
      host.setPointerCapture(e.pointerId);
      kick();
    }

    e.preventDefault();
    const rect = host.getBoundingClientRect();
    targetYaw.current = start.yaw + (dx / Math.max(rect.width, 1)) * Math.PI * 2;
    targetPitch.current = THREE.MathUtils.clamp(
      start.pitch + (dy / Math.max(rect.height, 1)) * Math.PI,
      -PITCH_MAX,
      PITCH_MAX,
    );
    kick();
  };

  const onPointerUp = (e: PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    kick();
    if (!start) return;
    const host = hostRef.current as HTMLElement | null;
    if (host?.hasPointerCapture(e.pointerId)) {
      host.releasePointerCapture(e.pointerId);
    }
    if (start.captured || start.discarded) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > TAP_PX) return;
    const camera = cameraRef.current;
    if (!host || !camera || !tapRef.current) return;
    const rect = host.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    );
    tapRef.current(ndc, camera);
  };

  return {
    hostRef,
    canvasRef,
    cameraRef,
    requestRender: kick,
    fit,
    pointer: {
      onPointerMove,
      onPointerDown,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
