import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Gender } from "../../lib/body";
import { REGION_LABEL, type RegionId } from "../../lib/muscleRegions";
import { PHYSIQUE_STAGE_CLASS } from "./constants";
import {
  classifyFigureRegion,
  fitPhysiqueCamera,
  loadPhysiqueSource,
  paintFigureMesh,
  preparePhysique,
  visibleEnvelope,
  PHYSIQUE_ZOOM_MAX,
  PHYSIQUE_ZOOM_MIN,
  type PhysiqueEnvelope,
  type PhysiqueKind,
  type PhysiqueMesh,
} from "./loadBody";

const TAP_PX = 12;
const BASE = new THREE.Color("#7a7a7a");
const HOT = new THREE.Color("#f4f4f4");
const SELECTED_EMISSIVE = new THREE.Color("#ffffff");
const NO_EMISSIVE = new THREE.Color(0x000000);

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function paintMuscle(
  entry: PhysiqueMesh,
  intensities: Record<RegionId, number>,
  selected: RegionId | null,
) {
  const mat = entry.mesh.material;
  if (!(mat instanceof THREE.MeshStandardMaterial)) return;
  const intensity = entry.regionId ? (intensities[entry.regionId] ?? 0) : 0;
  mat.color.copy(BASE).lerp(HOT, intensity);
  const on = entry.regionId !== null && entry.regionId === selected;
  mat.emissive.copy(on ? SELECTED_EMISSIVE : NO_EMISSIVE);
  mat.emissiveIntensity = on ? 0.14 : 0;
}

function pinchDistance(points: Map<number, { x: number; y: number }>) {
  if (points.size < 2) return 0;
  const [a, b] = [...points.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PhysiqueCanvas({
  gender,
  intensities,
  selected,
  onSelect,
  onError,
}: {
  gender: Gender;
  intensities: Record<RegionId, number>;
  selected: RegionId | null;
  onSelect: (id: RegionId) => void;
  onError?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const musclesRef = useRef<PhysiqueMesh[]>([]);
  const kindRef = useRef<PhysiqueKind>("anatomy");
  const envelopeRef = useRef<PhysiqueEnvelope | null>(null);
  const restRef = useRef<THREE.Object3D | null>(null);
  const intensitiesRef = useRef(intensities);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const renderRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  intensitiesRef.current = intensities;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let raf = 0;
    let yaw = 0.18;
    let targetYaw = yaw;
    let zoom = 1;
    let targetZoom = 1;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ownedMats: THREE.MeshStandardMaterial[] = [];
    const reduced = prefersReducedMotion();
    const pointers = new Map<number, { x: number; y: number }>();

    const drag = {
      id: -1,
      x: 0,
      y: 0,
      yaw: 0,
      captured: false,
      discarded: false,
    };
    const pinch = {
      active: false,
      startDist: 0,
      startZoom: 1,
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.setClearColor(0x0a0a0a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "pan-y";
    canvas.tabIndex = -1;
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = null;
    const key = new THREE.DirectionalLight(0xffffff, 1.08);
    key.position.set(0.2, 1.7, 2.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf0f0f0, 0.68);
    fill.position.set(-1.5, 0.6, 1.4);
    scene.add(fill);
    const front = new THREE.DirectionalLight(0xe8e8e8, 0.55);
    front.position.set(0, 0.25, 2.7);
    scene.add(front);
    const rim = new THREE.DirectionalLight(0xffffff, 0.32);
    rim.position.set(0.1, 1.0, -1.8);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.48));
    scene.add(new THREE.AmbientLight(0xb0b0b0, 0.52));

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
    const pivot = new THREE.Group();
    pivot.rotation.order = "YXZ";
    scene.add(pivot);
    let envelope: PhysiqueEnvelope | null = null;

    const applyPivot = () => {
      pivot.rotation.y = yaw;
      pivot.rotation.x = 0;
    };

    const render = () => {
      renderer.render(scene, camera);
    };
    renderRef.current = render;

    const applyFit = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      if (envelope) fitPhysiqueCamera(camera, envelope, w, h, zoom);
    };

    const kick = () => {
      if (raf) return;
      const loop = () => {
        raf = 0;
        if (reduced) {
          yaw = targetYaw;
          zoom = targetZoom;
        } else {
          yaw += (targetYaw - yaw) * 0.18;
          zoom += (targetZoom - zoom) * 0.22;
        }
        applyPivot();
        applyFit();
        render();
        const still =
          Math.abs(targetYaw - yaw) < 0.0004 &&
          Math.abs(targetZoom - zoom) < 0.0008;
        if (!still) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };

    const fit = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      if (envelope) {
        fitPhysiqueCamera(camera, envelope, w, h, zoom);
      } else {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      render();
    };

    const pick = (clientX: number, clientY: number) => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const figure = kindRef.current === "figure";
      const targets = musclesRef.current
        .filter((m) => m.mesh.visible && (figure || m.regionId))
        .map((m) => m.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      const hit = hits[0];
      if (!hit || !(hit.object instanceof THREE.Mesh)) return;
      if (figure) {
        const env = envelopeRef.current;
        const rest = restRef.current;
        if (!env || !rest) return;
        const local = hit.point.clone();
        rest.worldToLocal(local);
        const region = classifyFigureRegion(local, env);
        if (region) onSelectRef.current(region);
        return;
      }
      const muscle = musclesRef.current.find((m) => m.mesh === hit.object);
      if (!muscle?.regionId) return;
      onSelectRef.current(muscle.regionId);
    };

    const setZoom = (next: number) => {
      targetZoom = THREE.MathUtils.clamp(
        next,
        PHYSIQUE_ZOOM_MIN,
        PHYSIQUE_ZOOM_MAX,
      );
      kick();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        pinch.active = true;
        pinch.startDist = pinchDistance(pointers);
        pinch.startZoom = targetZoom;
        drag.id = -1;
        drag.discarded = true;
        drag.captured = false;
        host.setPointerCapture(e.pointerId);
        return;
      }
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.yaw = targetYaw;
      drag.captured = false;
      drag.discarded = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      const point = pointers.get(e.pointerId);
      if (point) {
        point.x = e.clientX;
        point.y = e.clientY;
      }
      if (pinch.active && pointers.size >= 2) {
        e.preventDefault();
        const dist = pinchDistance(pointers);
        if (pinch.startDist > 10) {
          setZoom(pinch.startZoom * (dist / pinch.startDist));
        }
        return;
      }
      if (drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.captured) {
        if (Math.hypot(dx, dy) <= TAP_PX) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          drag.discarded = true;
          return;
        }
        drag.captured = true;
        host.setPointerCapture(e.pointerId);
      }
      if (drag.discarded) return;
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      targetYaw = drag.yaw + (dx / Math.max(rect.width, 1)) * Math.PI * 1.6;
      kick();
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasPinch = pinch.active;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch.active = false;
      if (host.hasPointerCapture(e.pointerId)) {
        host.releasePointerCapture(e.pointerId);
      }
      if (wasPinch) {
        drag.id = -1;
        drag.discarded = true;
        return;
      }
      if (drag.id !== e.pointerId) return;
      const captured = drag.captured;
      const discarded = drag.discarded;
      const startX = drag.x;
      const startY = drag.y;
      drag.id = -1;
      if (captured || discarded) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > TAP_PX) return;
      pick(e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(targetZoom * Math.exp(-e.deltaY * 0.01));
    };

    applyPivot();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: false });
    fit();

    void loadPhysiqueSource(gender)
      .then((source) => {
        if (cancelled) return;
        const prepared = preparePhysique(source, gender);
        kindRef.current = prepared.kind;
        for (const entry of prepared.muscles) {
          const mat = new THREE.MeshStandardMaterial({
            color: BASE.clone(),
            roughness: prepared.kind === "figure" ? 0.62 : 0.52,
            metalness: 0.03,
            envMapIntensity: 0.18,
            vertexColors: prepared.kind === "figure",
          });
          ownedMats.push(mat);
          entry.mesh.material = mat;
        }
        musclesRef.current = prepared.muscles;
        if (prepared.kind === "figure") {
          prepared.root.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            if (prepared.muscles.some((entry) => entry.mesh === obj)) return;
            const mat = new THREE.MeshStandardMaterial({
              color: BASE.clone(),
              roughness: 0.62,
              metalness: 0.03,
            });
            ownedMats.push(mat);
            obj.material = mat;
          });
        }
        const yaw0 = pivot.rotation.y;
        pivot.rotation.set(0, 0, 0);
        pivot.add(prepared.root);
        pivot.updateWorldMatrix(true, true);
        envelope = visibleEnvelope(pivot);
        envelopeRef.current = envelope;
        restRef.current = pivot;
        if (prepared.kind === "figure") {
          for (const entry of prepared.muscles) {
            paintFigureMesh(
              entry,
              intensitiesRef.current,
              selectedRef.current,
              envelope,
              pivot,
              BASE,
              HOT,
            );
          }
        } else {
          for (const entry of prepared.muscles) {
            paintMuscle(entry, intensitiesRef.current, selectedRef.current);
          }
        }
        pivot.rotation.y = yaw0;
        setStatus("ready");
        fit();
        kick();
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        onError?.();
      });

    return () => {
      cancelled = true;
      observer.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
      musclesRef.current = [];
      kindRef.current = "anatomy";
      envelopeRef.current = null;
      restRef.current = null;
      renderRef.current = () => {};
      for (const mat of ownedMats) mat.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [gender, onError]);

  useEffect(() => {
    const env = envelopeRef.current;
    const rest = restRef.current;
    if (kindRef.current === "figure" && env && rest) {
      for (const entry of musclesRef.current) {
        paintFigureMesh(entry, intensities, selected, env, rest, BASE, HOT);
      }
    } else {
      for (const entry of musclesRef.current) {
        paintMuscle(entry, intensities, selected);
      }
    }
    renderRef.current();
  }, [intensities, selected]);

  return (
    <div
      className={PHYSIQUE_STAGE_CLASS}
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label={
        selected
          ? `${gender === "female" ? "Female physique" : "Physique"}, ${REGION_LABEL[selected]} selected. Drag to spin, pinch to zoom.`
          : `${gender === "female" ? "Female physique" : "Physique"}. Drag to spin, pinch to zoom, tap a muscle for its volume.`
      }
      data-physique-status={status}
      data-physique-gender={gender}
    >
      <div
        ref={hostRef}
        className="absolute inset-0"
        style={{ touchAction: "pan-y" }}
      />
      {status === "loading" && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-muted">
          Loading figure…
        </p>
      )}
      {status === "error" && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] leading-relaxed text-muted">
          The figure could not load.
        </p>
      )}
    </div>
  );
}
