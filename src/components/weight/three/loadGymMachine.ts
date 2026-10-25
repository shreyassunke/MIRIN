import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createGltfLoader } from "../../../lib/dracoGltf";

const cache = new Map<string, Promise<GLTF>>();

export function loadGymMachine(url: string): Promise<GLTF> {
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = createGltfLoader().loadAsync(url).catch((err: unknown) => {
    cache.delete(url);
    throw err;
  });
  cache.set(url, pending);
  return pending;
}
