import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { REGION_LABEL, type RegionId } from "../../lib/muscleRegions";
import { PHYSIQUE_STAGE_CLASS } from "./constants";
import {
  fitPhysiqueCamera,
  loadPhysiqueSource,
  preparePhysique,
  visibleEnvelope,
  type PhysiqueEnvelope,
  type PhysiqueMesh,
} from "./loadBody";
const TAP_PX = 12;
const PITCH_MAX = THREE.MathUtils.degToRad(48);
const BASE = new THREE.Color("#454545");
const HOT = new THREE.Color("#c8c8c8");
const SELECTED_EMISSIVE = new THREE.Color("#ececec");
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
  mat.emissiveIntensity = on ? 0.07 : 0;
}

export function PhysiqueCanvas({
  intensities,
  selected,
  onSelect,
  onError,
}: {
  intensities: Record<RegionId, number>;
  selected: RegionId | null;
  onSelect: (id: RegionId) => void;
  onError?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const musclesRef = useRef<PhysiqueMesh[]>([]);
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
    let yaw = 0.28;
    let pitch = 0.08;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ownedMats: THREE.MeshStandardMaterial[] = [];
    const reduced = prefersReducedMotion();

    const drag = {
      id: -1,
      x: 0,
      y: 0,
      yaw: 0,
      pitch: 0,
      captured: false,
      discarded: false,
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
    renderer.toneMappingExposure = 1.05;
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
    const key = new THREE.DirectionalLight(0xf0f0f0, 0.82);
    key.position.set(0.15, 1.7, 2.1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8d8d8, 0.5);
    fill.position.set(-1.4, 0.5, 1.5);
    scene.add(fill);
    const front = new THREE.DirectionalLight(0xcfcfcf, 0.38);
    front.position.set(0, 0.3, 2.6);
    scene.add(front);
    const rim = new THREE.DirectionalLight(0xffffff, 0.28);
    rim.position.set(0.15, 1.1, -1.8);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xe4e4e4, 0x2a2a2a, 0.42));
    scene.add(new THREE.AmbientLight(0x8a8a8a, 0.48));

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
    const pivot = new THREE.Group();
    pivot.rotation.order = "YXZ";
    scene.add(pivot);
    let envelope: PhysiqueEnvelope | null = null;

    const applyPivot = () => {
      pivot.rotation.y = yaw;
      pivot.rotation.x = pitch;
    };

    const render = () => {
      renderer.render(scene, camera);
    };
    renderRef.current = render;

    const kick = () => {
      if (raf) return;
      const loop = () => {
        raf = 0;
        if (reduced) {
          yaw = targetYaw;
          pitch = targetPitch;
        } else {
          yaw += (targetYaw - yaw) * 0.18;
          pitch += (targetPitch - pitch) * 0.18;
        }
        applyPivot();
        render();
        const still =
          Math.abs(targetYaw - yaw) < 0.0004 &&
          Math.abs(targetPitch - pitch) < 0.0004;
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
        fitPhysiqueCamera(camera, envelope, w, h);
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
      const targets = musclesRef.current
        .filter((m) => m.regionId && m.mesh.visible)
        .map((m) => m.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      const hit = hits[0];
      if (!hit || !(hit.object instanceof THREE.Mesh)) return;
      const muscle = musclesRef.current.find((m) => m.mesh === hit.object);
      if (!muscle?.regionId) return;
      onSelectRef.current(muscle.regionId);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.yaw = targetYaw;
      drag.pitch = targetPitch;
      drag.captured = false;
      drag.discarded = false;
    };

    const onPointerMove = (e: PointerEvent) => {
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
      targetPitch = THREE.MathUtils.clamp(
        drag.pitch + (dy / Math.max(rect.height, 1)) * Math.PI * 0.7,
        -PITCH_MAX,
        PITCH_MAX,
      );
      kick();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (drag.id !== e.pointerId) return;
      const captured = drag.captured;
      const discarded = drag.discarded;
      const startX = drag.x;
      const startY = drag.y;
      drag.id = -1;
      if (host.hasPointerCapture(e.pointerId)) {
        host.releasePointerCapture(e.pointerId);
      }
      if (captured || discarded) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > TAP_PX) return;
      pick(e.clientX, e.clientY);
    };

    applyPivot();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    fit();

    void loadPhysiqueSource()
      .then((source) => {
        if (cancelled) return;
        const prepared = preparePhysique(source);
        for (const entry of prepared.muscles) {
          const mat = new THREE.MeshStandardMaterial({
            color: BASE.clone(),
            roughness: 0.64,
            metalness: 0.02,
            envMapIntensity: 0.2,
            vertexColors: false,
          });
          ownedMats.push(mat);
          entry.mesh.material = mat;
        }
        musclesRef.current = prepared.muscles;
        for (const entry of prepared.muscles) {
          paintMuscle(entry, intensitiesRef.current, selectedRef.current);
        }
        const yaw0 = pivot.rotation.y;
        const pitch0 = pivot.rotation.x;
        pivot.rotation.set(0, 0, 0);
        pivot.add(prepared.root);
        pivot.updateWorldMatrix(true, true);
        envelope = visibleEnvelope(pivot);
        pivot.rotation.y = yaw0;
        pivot.rotation.x = pitch0;
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
      if (raf) cancelAnimationFrame(raf);
      musclesRef.current = [];
      renderRef.current = () => {};
      for (const mat of ownedMats) mat.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [onError]);

  useEffect(() => {
    for (const entry of musclesRef.current) {
      paintMuscle(entry, intensities, selected);
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
          ? `Physique, ${REGION_LABEL[selected]} selected`
          : "Physique, tap a muscle to see its volume"
      }
      data-physique-status={status}
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
