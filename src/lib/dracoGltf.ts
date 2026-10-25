import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DRACO_PATH = "/draco/";

let decoder: DRACOLoader | null = null;

function dracoDecoder(): DRACOLoader {
  if (!decoder) {
    decoder = new DRACOLoader();
    decoder.setDecoderPath(DRACO_PATH);
  }
  return decoder;
}

/** GLTF loader that can read the Draco meshes shipped under public/models. */
export function createGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoDecoder());
  return loader;
}
