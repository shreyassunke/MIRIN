import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  fascicleState,
  gainDelay,
  loadFiberVolume,
  type VolumeFascicle,
} from "../../lib/fiberVolume";
import type { RegionId } from "../../lib/muscleRegions";

const TONE: Record<"I" | "IIa" | "IIx", THREE.Color> = {
  I: new THREE.Color("#7d93a1"),
  IIa: new THREE.Color("#ab8f6b"),
  IIx: new THREE.Color("#c0715a"),
};

const IDLE = new THREE.Color("#3a3a3c");
const GAINED = new THREE.Color();
const EASE_EXPO = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

interface FiberField3DProps {
  region: RegionId;
  emphasis: number;
  stageOnset: number;
  onset: number;
  ceiling: number;
  runKey: string;
  label: string;
  onReady?: () => void;
  onFail?: () => void;
}

function readTone(klass: "I" | "IIa" | "IIx", varName: string) {
  if (typeof document === "undefined") return TONE[klass];
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? new THREE.Color(raw) : TONE[klass];
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function paint(
  colors: Float32Array,
  ranges: [number, number][],
  fascicles: VolumeFascicle[],
  stageOnset: number,
  onset: number,
  ceiling: number,
  now: number,
  runAt: number,
  tones: Record<"I" | "IIa" | "IIx", THREE.Color>,
) {
  const reduced = prefersReducedMotion();
  const mix = GAINED;
  for (let i = 0; i < fascicles.length; i++) {
    const fascicle = fascicles[i];
    const [start, end] = ranges[i];
    const state = fascicleState(
      fascicle.threshold,
      stageOnset,
      onset,
      ceiling,
    );
    const on = tones[fascicle.klass];
    if (state === "full") {
      mix.copy(on);
    } else if (state === "late") {
      mix.copy(IDLE).lerp(on, 0.42);
    } else if (state === "gained") {
      const delay = gainDelay(fascicle.threshold, stageOnset, onset);
      const t = reduced
        ? 1
        : EASE_EXPO(Math.min(1, Math.max(0, (now - runAt - delay) / 420)));
      mix.copy(IDLE).lerp(on, t);
    } else {
      mix.copy(IDLE);
    }
    for (let v = start; v < end; v++) {
      colors[v * 3] = mix.r;
      colors[v * 3 + 1] = mix.g;
      colors[v * 3 + 2] = mix.b;
    }
  }
}

function meshRole(obj: THREE.Object3D, emphasis: number) {
  if (obj.name.startsWith("near")) return "near";
  const numbered = obj.name.match(/^belly_(\d+)$/);
  if (numbered && Number(numbered[1]) !== emphasis) return "other";
  return "belly";
}

export function FiberField3D({
  region,
  emphasis,
  stageOnset,
  onset,
  ceiling,
  runKey,
  label,
  onReady,
  onFail,
}: FiberField3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onFailRef = useRef(onFail);
  onReadyRef.current = onReady;
  onFailRef.current = onFail;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let tubes: THREE.Mesh | null = null;
    let raf = 0;
    const disposables: THREE.Object3D[] = [];
    const materials: THREE.Material[] = [];

    const tones = {
      I: readTone("I", "--fiber-i"),
      IIa: readTone("IIa", "--fiber-iia"),
      IIx: readTone("IIx", "--fiber-iix"),
    };

    const start = async () => {
      const volume = await loadFiberVolume(region, emphasis);
      if (dead) return;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(28, 1.55, 0.02, 8);

      const key = new THREE.DirectionalLight(0xf2f2f2, 1.35);
      key.position.set(-0.8, 1.4, 1.6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xc8c8c8, 0.45);
      fill.position.set(1.3, 0.2, 0.6);
      scene.add(fill);
      scene.add(new THREE.HemisphereLight(0x8a8a8a, 0x2a2a2c, 0.55));

      const gltf = await new GLTFLoader().loadAsync(volume.url);
      if (dead) return;
      const shell = gltf.scene;

      shell.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry.computeVertexNormals();
        const role = meshRole(obj, emphasis);
        const material =
          role === "belly"
            ? new THREE.MeshPhysicalMaterial({
                color: 0xd0d0d2,
                roughness: 0.92,
                metalness: 0,
                transparent: true,
                opacity: 0.4,
                depthWrite: false,
                side: THREE.DoubleSide,
              })
            : new THREE.MeshStandardMaterial({
                color: 0x8a8a8c,
                roughness: 1,
                metalness: 0,
                transparent: true,
                opacity: role === "other" ? 0.14 : 0.2,
                depthWrite: false,
                side: THREE.DoubleSide,
              });
        obj.material = material;
        materials.push(material);
      });
      scene.add(shell);
      disposables.push(shell);

      const volumeBox = new THREE.Box3().setFromObject(shell);
      const center = volumeBox.getCenter(new THREE.Vector3());
      const size = volumeBox.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z, 0.03);
      const tubeR = THREE.MathUtils.clamp(span * 0.007, 0.0007, 0.0014);

      const geos: THREE.BufferGeometry[] = [];
      const ranges: [number, number][] = [];
      let cursor = 0;
      for (const fascicle of volume.fascicles) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < fascicle.points.length; i += 3) {
          pts.push(
            new THREE.Vector3(
              fascicle.points[i],
              fascicle.points[i + 1],
              fascicle.points[i + 2],
            ),
          );
        }
        if (pts.length < 2) continue;
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(
          curve,
          Math.max(8, pts.length * 2),
          tubeR,
          5,
          false,
        );
        ranges.push([cursor, cursor + geo.attributes.position.count]);
        cursor += geo.attributes.position.count;
        geos.push(geo);
      }

      if (geos.length) {
        const merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        if (merged) {
          merged.computeVertexNormals();
          const colors = new Float32Array(merged.attributes.position.count * 3);
          merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          tubes = new THREE.Mesh(
            merged,
            new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.42,
              metalness: 0,
            }),
          );
          materials.push(tubes.material as THREE.Material);
          scene.add(tubes);
          disposables.push(tubes);

          const runAt = performance.now();
          const lastGain = volume.fascicles.reduce((ms, fascicle) => {
            if (fascicleState(fascicle.threshold, stageOnset, onset, ceiling) !== "gained") {
              return ms;
            }
            return Math.max(ms, gainDelay(fascicle.threshold, stageOnset, onset));
          }, 0);
          const tick = (now: number) => {
            if (dead || !renderer || !scene || !camera || !tubes) return;
            paint(
              colors,
              ranges,
              volume.fascicles,
              stageOnset,
              onset,
              ceiling,
              now,
              runAt,
              tones,
            );
            merged.attributes.color.needsUpdate = true;
            renderer.render(scene, camera);
            const still =
              !prefersReducedMotion() && now - runAt < 420 + lastGain + 32;
            if (still) raf = requestAnimationFrame(tick);
          };
          tick(runAt);
        }
      }

      const look = center.clone();
      look.x -= size.x * 0.18;
      look.y += size.y * 0.06;
      camera.position.set(
        center.x + span * 0.22,
        center.y + span * 0.48,
        center.z + span * 1.28,
      );
      camera.lookAt(look);

      const resize = () => {
        if (!renderer || !camera || !host) return;
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.render(scene!, camera);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      (host as HTMLDivElement & { _ro?: ResizeObserver })._ro = ro;
      onReadyRef.current?.();
    };

    start().catch(() => {
      if (!dead) onFailRef.current?.();
    });

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      const ro = (host as HTMLDivElement & { _ro?: ResizeObserver })._ro;
      ro?.disconnect();
      disposables.forEach((obj) => {
        obj.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose();
        });
      });
      materials.forEach((mat) => mat.dispose());
      if (renderer) {
        if (renderer.domElement.parentElement === host) {
          host.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }
    };
  }, [region, emphasis, stageOnset, onset, ceiling, runKey]);

  return (
    <div
      ref={hostRef}
      className="fiber-stage"
      role="img"
      aria-label={label}
    />
  );
}
