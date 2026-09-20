import * as THREE from "three";

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const texCache = new Map<string, THREE.CanvasTexture>();

function remember(id: string, create: () => THREE.MeshStandardMaterial) {
  const hit = matCache.get(id);
  if (hit) return hit;
  const mat = create();
  mat.name = id;
  matCache.set(id, mat);
  return mat;
}

function canvasTex(
  id: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
): THREE.CanvasTexture {
  const hit = texCache.get(id);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  texCache.set(id, tex);
  return tex;
}

export function knurlBumpMap(): THREE.CanvasTexture {
  return canvasTex("knurl-bump", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#6a6a6a";
    ctx.fillRect(0, 0, w, h);
    const step = 14;
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "#d4d4d4";
    for (let y = -h; y < h * 2; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + w);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y - w);
      ctx.stroke();
    }
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 1.4;
    for (let y = -h + 7; y < h * 2; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + w);
      ctx.stroke();
    }
  });
}

export function knurlAlbedoMap(): THREE.CanvasTexture {
  return canvasTex(
    "knurl-albedo",
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#9a9aa0";
      ctx.fillRect(0, 0, w, h);
      const step = 12;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#e8e8ec";
      for (let y = -h; y < h * 2; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + w);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y - w);
        ctx.stroke();
      }
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#5c5c62";
      for (let y = -h + 6; y < h * 2; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + w);
        ctx.stroke();
      }
    },
    THREE.SRGBColorSpace,
  );
}

export function rubberBumpMap(): THREE.CanvasTexture {
  return canvasTex("rubber-bump", 128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const n = 118 + ((i * 17 + (i % 13) * 31) % 37);
      img.data[i * 4] = n;
      img.data[i * 4 + 1] = n;
      img.data[i * 4 + 2] = n;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

function contactShadowMap(): THREE.CanvasTexture {
  return canvasTex("contact-shadow", 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.48);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(0.5, "rgba(0,0,0,0.14)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function assignBump(
  mat: THREE.MeshStandardMaterial,
  map: THREE.CanvasTexture,
  sx: number,
  sy: number,
  scale: number,
) {
  const unique = map.clone();
  unique.repeat.set(sx, sy);
  unique.needsUpdate = true;
  mat.bumpMap = unique;
  mat.bumpScale = scale;
}

export function steelMaterial(id = "steel") {
  return remember(id, () => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d8d8dc"),
      metalness: 0.9,
      roughness: 0.3,
      envMapIntensity: 1.1,
    });
  });
}

export function knurlMaterial() {
  return remember("knurl", () => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c4c4c8"),
      metalness: 0.82,
      roughness: 0.42,
      envMapIntensity: 0.85,
    });
    const albedo = knurlAlbedoMap().clone();
    albedo.repeat.set(7, 14);
    albedo.needsUpdate = true;
    mat.map = albedo;
    assignBump(mat, knurlBumpMap(), 7, 14, 0.1);
    return mat;
  });
}

export function collarMaterial() {
  return remember("collar", () => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d0d0d4"),
      metalness: 0.9,
      roughness: 0.28,
      envMapIntensity: 1.05,
    });
  });
}

export function headMaterial() {
  return remember("head", () => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1a1a1a"),
      metalness: 0.1,
      roughness: 0.72,
      envMapIntensity: 0.28,
    });
    assignBump(mat, rubberBumpMap(), 3.5, 3.5, 0.014);
    return mat;
  });
}

export function plateMaterial(hex: string) {
  return remember(`plate:${hex}`, () => {
    // Enough sheen for the rim to carry a gradient — that curvature cue is
    // the only thing separating stacked discs at a near edge-on view — while
    // staying well short of a glass or chrome read.
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      metalness: 0.22,
      roughness: 0.48,
      envMapIntensity: 0.85,
      transparent: false,
      opacity: 1,
    });
    assignBump(mat, rubberBumpMap(), 2.4, 2.4, 0.016);
    return mat;
  });
}

export function hubMaterial() {
  return remember("hub", () => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c2c2c8"),
      metalness: 0.72,
      roughness: 0.3,
      envMapIntensity: 1.3,
      // The insert's outer wall sits flush against the plate's bore, where
      // the lathe leaves it wound away from the camera. Two-sided is the
      // cheap correct answer for a closed part this small; three.js flips
      // the normal for back faces, so the shading stays right.
      side: THREE.DoubleSide,
    });
  });
}

export function addContactShadow(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  y: number,
) {
  const mat = new THREE.MeshBasicMaterial({
    map: contactShadowMap(),
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
    toneMapped: false,
  });
  const geo = new THREE.PlaneGeometry(width, depth);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.name = "contactShadow";
  mesh.renderOrder = 0;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

export function createEnvironment(): THREE.DataTexture {
  const w = 256;
  const h = 128;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const i = (y * w + x) * 4;
      const floor = 12 + (1 - v) * 8;
      // Lifted overhead band: the upward-facing rims of a plate stack see
      // almost nothing but the zenith, and a dark zenith renders the top of
      // every stack as a black crescent.
      const sky = 30 + v * 62;
      let lum = v < 0.42 ? floor : sky;
      // three.js samples an equirect as u = atan2(z, x) / 2pi + 0.5, so
      // mirroring the world about x = 0 maps u to 1.5 - u: the fold line is
      // u = 0.75 (+z, toward the viewer), not u = 0.5. Driving every light
      // off `az` — 0 dead ahead, 1 dead behind, 0.5 at both sides — makes
      // the map symmetric under that mirror by construction.
      const az = Math.abs((((u - 0.75 + 1.5) % 1) + 1) % 1 - 0.5) * 2;
      const box =
        Math.exp(-Math.pow(az * 2.4, 2) * 2) *
        Math.exp(-Math.pow((v - 0.78) * 4.2, 2));
      lum += box * 180;
      const fill =
        Math.exp(-Math.pow((az - 0.5) * 4.5, 2)) *
        Math.exp(-Math.pow((v - 0.55) * 2.8, 2));
      lum += fill * 70;
      const k = Math.max(10, Math.min(255, lum));
      data[i] = k;
      data[i + 1] = k;
      data[i + 2] = Math.min(255, k + 2);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft key from front-top, a fill, and a rim. Pass `symmetric` when the pose
 * has to survive a horizontal flip: it puts the key and rim on x = 0 and
 * splits the fill into a mirrored pair of half-intensity lights.
 */
export function addInstrumentLights(
  scene: THREE.Scene,
  opts?: { symmetric?: boolean },
) {
  const symmetric = opts?.symmetric ?? false;

  const key = new THREE.DirectionalLight(0xf2f2f2, symmetric ? 1.1 : 1.35);
  key.position.set(symmetric ? 0 : -0.6, 1.8, 2.2);
  scene.add(key);

  if (symmetric) {
    // A plate face points along +/-x, so a light on the x = 0 midline leaves
    // it at NdotL = 0 — the faces the whole pose exists to show would render
    // on ambient alone. This raking pair is what actually lights them, and
    // each face only ever sees the one on its own side.
    for (const x of [-1.9, 1.9]) {
      const fill = new THREE.DirectionalLight(0xdcdce2, 0.85);
      fill.position.set(x, 0.5, 1.1);
      scene.add(fill);
    }
  } else {
    const fill = new THREE.DirectionalLight(0xc8c8c8, 0.45);
    fill.position.set(1.4, 0.4, 0.8);
    scene.add(fill);
  }

  // Looking slightly down the bar means the top of each stack is the disc's
  // far side, which the front key never reaches. The back kicker is what
  // stops that crescent from going black.
  const rim = new THREE.DirectionalLight(0xffffff, symmetric ? 0.9 : 0.55);
  rim.position.set(symmetric ? 0 : 0.1, 0.9, -1.8);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x7a7a7a, 0.28));
}
