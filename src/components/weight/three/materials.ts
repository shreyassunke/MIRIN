import * as THREE from "three";

const cache = new Map<string, THREE.MeshStandardMaterial>();

function remember(id: string, create: () => THREE.MeshStandardMaterial) {
  const hit = cache.get(id);
  if (hit) return hit;
  const mat = create();
  mat.name = id;
  cache.set(id, mat);
  return mat;
}

/** Satin shaft / sleeve — DESIGN.md accent, as metal, not a paint fill. */
export function steelMaterial(id = "steel") {
  return remember(id, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c8c8c8"),
      metalness: 0.82,
      roughness: 0.38,
      envMapIntensity: 0.72,
    }),
  );
}

export function collarMaterial() {
  return remember(
    "collar",
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#b0b0b0"),
        metalness: 0.78,
        roughness: 0.44,
        envMapIntensity: 0.6,
      }),
  );
}

export function knurlMaterial() {
  return remember(
    "knurl",
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#9c9c9c"),
        metalness: 0.7,
        roughness: 0.55,
        envMapIntensity: 0.45,
      }),
  );
}

/** Muted plate-convention hue from `PLATE_COLORS`. */
export function plateMaterial(hex: string) {
  return remember(
    `plate:${hex}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        metalness: 0.16,
        roughness: 0.58,
        envMapIntensity: 0.32,
      }),
  );
}

export function hubMaterial() {
  return remember(
    "hub",
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#141414"),
        metalness: 0.04,
        roughness: 0.84,
        envMapIntensity: 0.12,
      }),
  );
}

export function headMaterial() {
  return remember(
    "head",
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#9a9a9a"),
        metalness: 0.36,
        roughness: 0.5,
        envMapIntensity: 0.4,
      }),
  );
}

/** Grayscale studio gradient — no HDRI file, no hue. */
export function createEnvironment(): THREE.DataTexture {
  const w = 64;
  const h = 32;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const lift = (1 - v) * 30;
    const r = 16 + lift;
    const g = 16 + lift;
    const b = 18 + lift * 1.05;
    for (let x = 0; x < w; x++) {
      const n = Math.sin(x * 0.38) * 5;
      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, r + n));
      data[i + 1] = Math.max(0, Math.min(255, g + n));
      data[i + 2] = Math.max(0, Math.min(255, b + n * 1.15));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Key / fill / rim — grayscale only, instrument lighting on near-black. */
export function addInstrumentLights(scene: THREE.Scene) {
  const key = new THREE.DirectionalLight(0xfafafa, 1.55);
  key.position.set(-0.85, 1.15, 1.45);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc4c4c4, 0.4);
  fill.position.set(0.7, -0.45, 0.85);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.62);
  rim.position.set(0.35, 0.28, -1.25);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x8a8a8a, 0.2));
}
