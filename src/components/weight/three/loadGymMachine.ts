import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

const cache = new Map<string, Promise<GLTF>>();

export function loadGymMachine(url: string): Promise<GLTF> {
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = new GLTFLoader().loadAsync(url).catch((err: unknown) => {
    cache.delete(url);
    throw err;
  });
  cache.set(url, pending);
  return pending;
}
