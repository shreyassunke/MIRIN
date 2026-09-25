import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Gender } from "./body";

export const AGE_KEY = "profile.age";
export const AVATAR_KEY = "profile.avatar";
export const GENDER_KEY = "body.gender";

const MAX_EDGE = 256;
const MAX_CHARS = 120_000;
const MAX_FILE_BYTES = 15_000_000;
const WORKING_EDGE = 2048;

export const AVATAR_CROP_VIEW = 220;
export const AVATAR_SCALE_MIN = 1;
export const AVATAR_SCALE_MAX = 3;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function profileInitial(name: string, email: string): string {
  const source = name.trim() || email.trim();
  return source ? source.charAt(0).toUpperCase() : "";
}

/** null while IndexedDB is loading, "" when unset. */
export function useSettingValue(key: string): string | null {
  return useLiveQuery(
    async () => (await db.settings.get(key))?.value ?? "",
    [key],
    null,
  );
}

export async function writeSetting(
  key: string,
  value: string | null,
): Promise<void> {
  if (value == null || value === "") {
    await db.settings.delete(key);
    return;
  }
  await db.settings.put({ key, value });
}

export function parseAge(
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(trimmed)) {
    return { ok: false, error: "Enter an age in years." };
  }
  const age = Number(trimmed);
  if (age < 1 || age > 120) {
    return { ok: false, error: "Enter an age from 1 to 120." };
  }
  return { ok: true, value: String(age) };
}

export function parseGender(value: string | null | undefined): Gender | null {
  return value === "male" || value === "female" ? value : null;
}

export function clampAvatarScale(scale: number): number {
  if (!Number.isFinite(scale)) return AVATAR_SCALE_MIN;
  return Math.min(AVATAR_SCALE_MAX, Math.max(AVATAR_SCALE_MIN, scale));
}

/** Pan limits so the circular crop stays filled. Scale 1 is cover-fit. */
export function clampAvatarOffset(
  x: number,
  y: number,
  iw: number,
  ih: number,
  view: number,
  scale: number,
): { x: number; y: number } {
  if (iw < 1 || ih < 1 || view < 1) return { x: 0, y: 0 };
  const safe = clampAvatarScale(scale);
  const base = Math.max(view / iw, view / ih);
  const maxX = Math.max(0, (iw * base * safe - view) / 2);
  const maxY = Math.max(0, (ih * base * safe - view) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

export function avatarCropFrame(
  iw: number,
  ih: number,
  view: number,
  scale: number,
  x: number,
  y: number,
) {
  const safe = clampAvatarScale(scale);
  const clamped = clampAvatarOffset(x, y, iw, ih, view, safe);
  const base = Math.max(view / iw, view / ih);
  const width = iw * base * safe;
  const height = ih * base * safe;
  return {
    scale: safe,
    x: clamped.x,
    y: clamped.y,
    width,
    height,
    left: (view - width) / 2 + clamped.x,
    top: (view - height) / 2 + clamped.y,
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that photo."));
    image.src = src;
  });
}

function photoTypeOk(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

/** Downscale and bake orientation so the crop stage stays light. */
export async function decodePhoto(
  file: File,
): Promise<{ image: HTMLImageElement; revoke: () => void } | { error: string }> {
  if (!photoTypeOk(file)) {
    return { error: "Use a JPEG, PNG, or WebP photo." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That photo is too large. Try another." };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: "Could not read that photo." };
  }
  const scale = Math.min(1, WORKING_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { error: "Could not read that photo." };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92);
  });
  if (!blob) return { error: "Could not read that photo." };
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return { image, revoke: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return { error: "Could not read that photo." };
  }
}

export function renderAvatarCrop(
  image: CanvasImageSource,
  iw: number,
  ih: number,
  view: number,
  scale: number,
  x: number,
  y: number,
): HTMLCanvasElement | null {
  if (iw < 1 || ih < 1) return null;
  const frame = avatarCropFrame(iw, ih, view, scale, x, y);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_EDGE;
  canvas.height = MAX_EDGE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const k = MAX_EDGE / view;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    frame.left * k,
    frame.top * k,
    frame.width * k,
    frame.height * k,
  );
  return canvas;
}

/** Square JPEG data URL, small enough to sync with the rest of the log. */
export function canvasToAvatar(
  canvas: HTMLCanvasElement,
): { dataUrl: string } | { error: string } {
  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_CHARS && quality > 0.5) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_CHARS) {
    return { error: "That photo is too large. Try another." };
  }
  return { dataUrl };
}
