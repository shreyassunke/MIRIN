import * as THREE from "three";
import { addInstrumentLights, createEnvironment } from "./materials";

export type FrameFn = (now: number) => boolean;

let renderer: THREE.WebGLRenderer | null = null;
let env: THREE.Texture | null = null;
let envRT: THREE.WebGLRenderTarget | null = null;
let refs = 0;
let disposeTimer = 0;
let raf = 0;
let hidden = false;
const frames = new Set<FrameFn>();

const DISPOSE_MS = 4000;

function ensureRenderer(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });
  renderer.setClearColor(0x0a0a0a, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const el = renderer.domElement;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.touchAction = "pan-y";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  const equirect = createEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  envRT = pmrem.fromEquirectangular(equirect);
  env = envRT.texture;
  equirect.dispose();
  pmrem.dispose();
  return renderer;
}

export function getEnvironment(): THREE.Texture | null {
  ensureRenderer();
  return env;
}

export function acquireCanvas(host: HTMLElement): HTMLCanvasElement {
  const r = ensureRenderer();
  refs += 1;
  if (disposeTimer) {
    window.clearTimeout(disposeTimer);
    disposeTimer = 0;
  }
  if (r.domElement.parentElement !== host) {
    host.appendChild(r.domElement);
  }
  hidden = document.visibilityState === "hidden";
  return r.domElement;
}

export function releaseCanvas(host: HTMLElement) {
  if (renderer && renderer.domElement.parentElement === host) {
    host.removeChild(renderer.domElement);
  }
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    disposeTimer = window.setTimeout(disposeRenderer, DISPOSE_MS);
  }
}

function disposeRenderer() {
  cancelAnimationFrame(raf);
  raf = 0;
  frames.clear();
  renderer?.dispose();
  renderer?.domElement.remove();
  renderer = null;
  envRT?.dispose();
  envRT = null;
  env = null;
}

export function configureSize(width: number, height: number) {
  if (!renderer) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(Math.max(1, width), Math.max(1, height), false);
}

export function renderNow(scene: THREE.Scene, camera: THREE.Camera) {
  if (!renderer || hidden) return;
  renderer.render(scene, camera);
}

export function requestFrames(fn: FrameFn) {
  frames.add(fn);
  kick();
}

export function cancelFrames(fn: FrameFn) {
  frames.delete(fn);
}

function kick() {
  if (raf || hidden) return;
  const loop = (now: number) => {
    raf = 0;
    if (hidden) return;
    for (const fn of [...frames]) {
      if (!fn(now)) frames.delete(fn);
    }
    if (frames.size) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function onVisibility() {
  hidden = document.visibilityState === "hidden";
  if (!hidden && frames.size) kick();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibility);
}

export function createInstrumentScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = null;
  addInstrumentLights(scene);
  scene.environment = getEnvironment();
  scene.environmentIntensity = 1.12;
  return scene;
}
