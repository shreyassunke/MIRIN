import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent,
} from "react";
import * as THREE from "three";
import {
  attachCanvas,
  bakeSceneToCanvas,
  cancelFrames,
  configureSize,
  createInstrumentScene,
  detachCanvas,
  releaseRenderer,
  renderNow,
  requestFrames,
  retainRenderer,
  type FrameFn,
} from "./stage";
import {
  aimFixedCamera,
  BARBELL_CAM,
  fitFixedCamera,
  fitOrthoCamera,
  type FixedCamPose,
} from "./scale";

const PITCH_MAX = THREE.MathUtils.degToRad(80);
/** Movement below this is a tap. Past it, the step/swipe axis captures; the other axis may scroll. */
export const TAP_PX = 12;

/**
 * `orbit` frames the object orthographically and lets a drag spin it.
 * `fixed` holds one authored perspective pose: the camera never leaves the
 * x = 0 midline and the model is never rotated, so the render stays mirror
 * symmetric. Pointer input only nudges the camera's elevation.
 */
export type StageMode = "orbit" | "fixed";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type AttachFn = (pivot: THREE.Group) => () => void;

type CaptureKind = "step" | "swipe";

type DragStart = {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  pointerId: number;
  captured: boolean;
  discarded: boolean;
  kind?: CaptureKind;
};

export function useWeightStage(opts: {
  attach: AttachFn;
  extraFrame?: FrameFn;
  onTap?: (
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    rect: DOMRectReadOnly,
  ) => void;
  /** Drag steps the rack. Sign is index delta. Axis comes from `stepAxis`. */
  onStep?: (direction: -1 | 1) => void;
  /** "y" = vertical drag (up = +1). "x" = horizontal. Default "y". */
  stepAxis?: "x" | "y";
  /** One horizontal flick. -1 = right (prev), +1 = left (next). */
  onSwipe?: (direction: -1 | 1) => void;
  /** Pixels of travel per onStep. Default 36. */
  stepPx?: number;
  /** Pixels of horizontal travel to commit a swipe. Default 40. */
  swipePx?: number;
  padding?: number;
  mode?: StageMode;
  /** Authored perspective pose. Ignored unless `mode` is `fixed`. */
  pose?: FixedCamPose;
  /** Symmetric light rig. Required whenever the pose must mirror exactly. */
  symmetricLights?: boolean;
  /**
   * The shared WebGL canvas can only sit on one host. Inactive pager pages
   * keep the same 3D scene and show a still of it instead of the old SVG.
   */
  live?: boolean;
}) {
  const live = opts.live ?? true;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stillRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef(live);
  const pagingRef = useRef(false);
  liveRef.current = live;
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const parallax = useRef(0);
  const targetParallax = useRef(0);
  const drag = useRef<DragStart | null>(null);
  const attachRef = useRef(opts.attach);
  const extraRef = useRef(opts.extraFrame);
  const tapRef = useRef(opts.onTap);
  const stepRef = useRef(opts.onStep);
  const swipeRef = useRef(opts.onSwipe);
  const stepPx = opts.stepPx ?? 36;
  const swipePx = opts.swipePx ?? 40;
  const stepAxis = opts.stepAxis ?? "y";
  const padding = opts.padding ?? 1.15;
  const mode = opts.mode ?? "orbit";
  const pose = opts.pose ?? BARBELL_CAM;
  const symmetricLights = opts.symmetricLights ?? mode === "fixed";
  attachRef.current = opts.attach;
  extraRef.current = opts.extraFrame;
  tapRef.current = opts.onTap;
  stepRef.current = opts.onStep;
  swipeRef.current = opts.onSwipe;

  const bakeStill = useCallback(() => {
    const dest = stillRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const host = hostRef.current;
    if (!dest || !scene || !camera || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pxW = Math.max(1, Math.round(w * dpr));
    const pxH = Math.max(1, Math.round(h * dpr));
    if (dest.width !== pxW || dest.height !== pxH) {
      dest.width = pxW;
      dest.height = pxH;
    }
    bakeSceneToCanvas(scene, camera, dest);
  }, []);

  const requestRender = useCallback(() => {
    if (!liveRef.current) {
      bakeStill();
      return;
    }
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    renderNow(scene, camera);
  }, [bakeStill]);

  const fit = useCallback(() => {
    const camera = cameraRef.current;
    const pivot = pivotRef.current;
    const host = hostRef.current;
    if (!camera || !pivot || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;
    if (liveRef.current) configureSize(w, h);
    if (camera instanceof THREE.PerspectiveCamera) {
      fitFixedCamera(camera, pivot, w, h, pose);
      aimFixedCamera(camera, parallax.current, pose);
    } else if (camera instanceof THREE.OrthographicCamera) {
      const rot = pivot.rotation.clone();
      pivot.rotation.set(0, 0, 0);
      pivot.updateWorldMatrix(true, true);
      fitOrthoCamera(camera, pivot, w, h, padding);
      pivot.rotation.copy(rot);
    }
    requestRender();
  }, [padding, pose, requestRender]);

  const spring: FrameFn = useCallback(
    (now) => {
      const extra = extraRef.current?.(now) ?? false;
      const still = prefersReducedMotion();
      const camera = cameraRef.current;
      const pivot = pivotRef.current;
      let settling = false;

      if (mode === "fixed") {
        if (still) {
          parallax.current = 0;
          targetParallax.current = 0;
        } else {
          parallax.current += (targetParallax.current - parallax.current) * 0.22;
          settling =
            Math.abs(targetParallax.current - parallax.current) > 0.0015;
          // Snap the tail so the rest pose is exactly symmetric, not merely
          // close to it — the flip test has no tolerance for a stray fraction
          // of a degree.
          if (!settling) parallax.current = targetParallax.current;
        }
        if (camera instanceof THREE.PerspectiveCamera) {
          aimFixedCamera(camera, parallax.current, pose);
        }
      } else {
        if (still) {
          yaw.current = 0;
          pitch.current = 0;
          targetYaw.current = 0;
          targetPitch.current = 0;
        } else {
          yaw.current += (targetYaw.current - yaw.current) * 0.28;
          pitch.current += (targetPitch.current - pitch.current) * 0.28;
          settling =
            Math.abs(targetYaw.current - yaw.current) > 0.0004 ||
            Math.abs(targetPitch.current - pitch.current) > 0.0004;
        }
        if (pivot) pivot.rotation.set(pitch.current, yaw.current, 0);
      }

      requestRender();
      return extra || settling || !!drag.current;
    },
    [mode, pose, requestRender],
  );

  const kick = useCallback(() => {
    if (!liveRef.current || pagingRef.current) {
      bakeStill();
      return;
    }
    requestFrames(spring);
  }, [bakeStill, spring]);

  const syncHost = useCallback(() => {
    const host = hostRef.current;
    const dest = stillRef.current;
    if (!host || !dest) return;
    const wantLive = liveRef.current && !pagingRef.current;
    if (wantLive) {
      if (dest.parentElement === host) dest.remove();
      const canvas = attachCanvas(host);
      canvasRef.current = canvas;
      fit();
      kick();
      return;
    }
    cancelFrames(spring);
    bakeStill();
    detachCanvas(host);
    canvasRef.current = null;
    if (dest.parentElement !== host) host.appendChild(dest);
  }, [bakeStill, fit, kick, spring]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    retainRenderer();

    const dest = document.createElement("canvas");
    dest.dataset.weightStage = "still";
    dest.setAttribute("aria-hidden", "true");
    dest.style.display = "block";
    dest.style.width = "100%";
    dest.style.height = "100%";
    dest.style.pointerEvents = "none";
    stillRef.current = dest;

    const scene = createInstrumentScene({ symmetric: symmetricLights });
    const camera =
      mode === "fixed"
        ? new THREE.PerspectiveCamera(20, 1, 1, 1000)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    const pivot = new THREE.Group();
    scene.add(pivot);

    sceneRef.current = scene;
    cameraRef.current = camera;
    pivotRef.current = pivot;

    const detach = attachRef.current(pivot);
    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(host);

    return () => {
      cancelFrames(spring);
      ro.disconnect();
      detach();
      dest.remove();
      stillRef.current = null;
      releaseRenderer();
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      pivotRef.current = null;
      canvasRef.current = null;
    };
  }, [fit, mode, spring, symmetricLights]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    syncHost();
    return () => {
      bakeStill();
      detachCanvas(host);
      canvasRef.current = null;
      const dest = stillRef.current;
      if (dest?.parentElement === host) dest.remove();
    };
  }, [bakeStill, live, syncHost]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const watched =
      host.closest(".load-swipe-field") ?? host.closest(".load-pager-root");
    if (!watched) return;
    const update = () => {
      const next = Boolean(host.closest(".is-paging"));
      if (next === pagingRef.current) return;
      pagingRef.current = next;
      syncHost();
    };
    const observer = new MutationObserver(update);
    observer.observe(watched, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, [syncHost]);

  const setParallaxFromEvent = (e: PointerEvent) => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;
    const rect = host.getBoundingClientRect();
    const t = 1 - ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2;
    targetParallax.current = THREE.MathUtils.clamp(t, -1, 1);
    kick();
  };

  const releaseParallax = () => {
    targetParallax.current = 0;
    kick();
  };

  useEffect(() => {
    const clear = (event: globalThis.PointerEvent) => {
      const start = drag.current;
      if (!start || start.pointerId !== event.pointerId || start.captured) return;
      drag.current = null;
      if (mode === "fixed") releaseParallax();
    };
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [mode]);

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
    if (mode === "fixed") {
      const start = drag.current;
      const host = hostRef.current;
      if (start && !start.discarded && host) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!start.captured) {
          if (e.defaultPrevented) {
            start.discarded = true;
          } else if (Math.hypot(dx, dy) > TAP_PX) {
            const vertical = Math.abs(dy) >= Math.abs(dx);
            if (vertical) {
              if (stepAxis === "y" && stepRef.current) {
                start.captured = true;
                start.kind = "step";
                start.y = e.clientY;
                host.setPointerCapture(e.pointerId);
              } else {
                start.discarded = true;
              }
            } else if (stepAxis === "x" && stepRef.current) {
              start.captured = true;
              start.kind = "step";
              start.x = e.clientX;
              host.setPointerCapture(e.pointerId);
            } else if (swipeRef.current) {
              start.captured = true;
              start.kind = "swipe";
              host.setPointerCapture(e.pointerId);
            } else {
              start.discarded = true;
            }
          }
        } else if (start.kind === "step" && stepRef.current) {
          e.preventDefault();
          if (stepAxis === "y") {
            let remain = e.clientY - start.y;
            while (Math.abs(remain) >= stepPx) {
              const dir = remain > 0 ? 1 : -1;
              // Finger up (negative dy) advances to the next heavier bell.
              stepRef.current(-dir as -1 | 1);
              start.y += dir * stepPx;
              remain = e.clientY - start.y;
            }
          } else {
            let remain = e.clientX - start.x;
            while (Math.abs(remain) >= stepPx) {
              const dir = remain > 0 ? 1 : -1;
              stepRef.current(-dir as -1 | 1);
              start.x += dir * stepPx;
              remain = e.clientX - start.x;
            }
          }
        } else if (start.kind === "swipe") {
          e.preventDefault();
        }
      }
      if (!drag.current?.captured) setParallaxFromEvent(e);
      return;
    }
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
    if (mode === "fixed") releaseParallax();
    else kick();
    if (!start) return;
    const host = hostRef.current as HTMLElement | null;
    if (host?.hasPointerCapture(e.pointerId)) {
      host.releasePointerCapture(e.pointerId);
    }
    if (start.kind === "swipe" && swipeRef.current) {
      const travel = e.clientX - start.x;
      if (Math.abs(travel) >= swipePx) {
        swipeRef.current((travel < 0 ? 1 : -1) as -1 | 1);
      }
      return;
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
    tapRef.current(ndc, camera, rect);
  };

  const onPointerLeave = () => {
    if (mode === "fixed") releaseParallax();
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
      onPointerLeave,
    },
  };
}
