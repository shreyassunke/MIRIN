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

const YAW_MAX = THREE.MathUtils.degToRad(8);
const PITCH_MAX = THREE.MathUtils.degToRad(5);
export const TAP_PX = 6;

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type AttachFn = (pivot: THREE.Group) => () => void;

export function useWeightStage(opts: {
  cameraZ: number;
  cameraX?: number;
  cameraY?: number;
  restYaw?: number;
  restPitch?: number;
  attach: AttachFn;
  extraFrame?: FrameFn;
  onTap?: (ndc: THREE.Vector2, camera: THREE.Camera) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const restYaw = opts.restYaw ?? 0;
  const restPitch = opts.restPitch ?? 0;
  const yaw = useRef(restYaw);
  const pitch = useRef(restPitch);
  const targetYaw = useRef(restYaw);
  const targetPitch = useRef(restPitch);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const attachRef = useRef(opts.attach);
  const extraRef = useRef(opts.extraFrame);
  const tapRef = useRef(opts.onTap);
  attachRef.current = opts.attach;
  extraRef.current = opts.extraFrame;
  tapRef.current = opts.onTap;

  const requestRender = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    renderNow(scene, camera);
  }, []);

  const spring: FrameFn = useCallback(
    (now) => {
      const extra = extraRef.current?.(now) ?? false;
      const reduced = prefersReducedMotion();
      if (reduced) {
        yaw.current = restYaw;
        pitch.current = restPitch;
        targetYaw.current = restYaw;
        targetPitch.current = restPitch;
      } else {
        yaw.current += (targetYaw.current - yaw.current) * 0.16;
        pitch.current += (targetPitch.current - pitch.current) * 0.16;
      }
      const pivot = pivotRef.current;
      if (pivot) pivot.rotation.set(pitch.current, yaw.current, 0);
      requestRender();
      const settling =
        !reduced &&
        (Math.abs(targetYaw.current - yaw.current) > 0.0004 ||
          Math.abs(targetPitch.current - pitch.current) > 0.0004);
      return extra || settling;
    },
    [requestRender, restPitch, restYaw],
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
    const camera = new THREE.PerspectiveCamera(28, 3.4, 0.08, 20);
    camera.position.set(opts.cameraX ?? 0, opts.cameraY ?? 0, opts.cameraZ);
    camera.lookAt(0, 0, 0);
    const pivot = new THREE.Group();
    scene.add(pivot);

    sceneRef.current = scene;
    cameraRef.current = camera;
    pivotRef.current = pivot;

    const detach = attachRef.current(pivot);

    const size = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 2 || h < 2) return;
      configureSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestRender();
    };
    const ro = new ResizeObserver(size);
    ro.observe(host);
    size();
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
  }, [kick, opts.cameraX, opts.cameraY, opts.cameraZ, requestRender, spring]);

  const aimFromEvent = (e: PointerEvent) => {
    if (prefersReducedMotion()) return;
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    targetYaw.current = restYaw + nx * YAW_MAX;
    targetPitch.current = restPitch - ny * PITCH_MAX;
    kick();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (pointerDown.current) aimFromEvent(e);
  };

  const onPointerDown = (e: PointerEvent) => {
    pointerDown.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent) => {
    const start = pointerDown.current;
    pointerDown.current = null;
    targetYaw.current = restYaw;
    targetPitch.current = restPitch;
    kick();
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > TAP_PX) return;
    const host = hostRef.current;
    const camera = cameraRef.current;
    if (!host || !camera || !tapRef.current) return;
    const rect = host.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    );
    tapRef.current(ndc, camera);
  };

  const onPointerLeave = () => {
    pointerDown.current = null;
    targetYaw.current = restYaw;
    targetPitch.current = restPitch;
    kick();
  };

  return {
    hostRef,
    canvasRef,
    cameraRef,
    requestRender: kick,
    pointer: {
      onPointerMove,
      onPointerDown,
      onPointerUp,
      onPointerLeave,
    },
  };
}
