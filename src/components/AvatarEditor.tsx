import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  AVATAR_CROP_VIEW,
  AVATAR_KEY,
  AVATAR_SCALE_MAX,
  AVATAR_SCALE_MIN,
  avatarCropFrame,
  canvasToAvatar,
  clampAvatarOffset,
  clampAvatarScale,
  decodePhoto,
  loadImage,
  profileInitial,
  renderAvatarCrop,
  writeSetting,
} from "../lib/profile";

type Point = { x: number; y: number };
type Gesture =
  | { kind: "pan"; x: number; y: number; ox: number; oy: number }
  | { kind: "pinch"; dist: number; scale: number };

export function AvatarEditor({
  open,
  storedSrc,
  name,
  email,
  onClose,
}: {
  open: boolean;
  storedSrc: string;
  name: string;
  email: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const hintId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const requestId = useRef(0);
  const ownedRevoke = useRef<(() => void) | null>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const metrics = useRef({ w: 0, h: 0 });
  const viewRef = useRef(AVATAR_CROP_VIEW);
  const storedRef = useRef(storedSrc);
  storedRef.current = storedSrc;

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [reading, setReading] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [view, setView] = useState(AVATAR_CROP_VIEW);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function releaseOwned() {
    ownedRevoke.current?.();
    ownedRevoke.current = null;
  }

  function rememberMetrics(next: HTMLImageElement | null) {
    metrics.current = {
      w: next?.naturalWidth ?? 0,
      h: next?.naturalHeight ?? 0,
    };
  }

  function applyOffset(x: number, y: number) {
    const next = clampAvatarOffset(
      x,
      y,
      metrics.current.w,
      metrics.current.h,
      viewRef.current,
      scaleRef.current,
    );
    offsetRef.current = next;
    setOffset(next);
  }

  function applyScale(nextScale: number) {
    const safe = clampAvatarScale(nextScale);
    scaleRef.current = safe;
    setScale(safe);
    applyOffset(offsetRef.current.x, offsetRef.current.y);
  }

  function resetTransform() {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function adopt(next: HTMLImageElement | null, revoke: (() => void) | null) {
    releaseOwned();
    ownedRevoke.current = revoke;
    rememberMetrics(next);
    setImage(next);
    resetTransform();
  }

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setError(null);
    setEdited(false);
    setBusy(null);
    const src = storedRef.current;
    if (!src) {
      setReading(false);
      adopt(null, null);
      return;
    }
    setReading(true);
    adopt(null, null);
    void loadImage(src).then(
      (next) => {
        if (id !== requestId.current) return;
        adopt(next, null);
        setReading(false);
      },
      () => {
        if (id !== requestId.current) return;
        setReading(false);
        setError("Could not read that photo.");
      },
    );
    return () => {
      requestId.current += 1;
      releaseOwned();
    };
    // Load the photo that was stored when the editor opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const el = cropRef.current;
    if (!el || !image) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyScale(scaleRef.current * (event.deltaY > 0 ? 0.96 : 1.04));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [image]);

  useLayoutEffect(() => {
    const el = cropRef.current;
    if (!el || !open) return;
    const update = () => {
      const next = el.clientWidth;
      if (next < 1 || Math.abs(next - viewRef.current) < 0.5) return;
      viewRef.current = next;
      setView(next);
      applyOffset(offsetRef.current.x, offsetRef.current.y);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, image]);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const id = ++requestId.current;
    setReading(true);
    setError(null);
    const result = await decodePhoto(file);
    if (id !== requestId.current) {
      if ("revoke" in result) result.revoke();
      return;
    }
    setReading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    adopt(result.image, result.revoke);
    setEdited(true);
  }

  async function onRotate() {
    if (!image || busy) return;
    const id = ++requestId.current;
    setReading(true);
    setError(null);
    const result = await rotateClockwise(image);
    if (id !== requestId.current) {
      if ("revoke" in result) result.revoke();
      return;
    }
    setReading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    adopt(result.image, result.revoke);
    setEdited(true);
  }

  async function onSave() {
    if (!image || busy) return;
    setBusy("save");
    setError(null);
    const canvas = renderAvatarCrop(
      image,
      image.naturalWidth,
      image.naturalHeight,
      viewRef.current,
      scaleRef.current,
      offsetRef.current.x,
      offsetRef.current.y,
    );
    if (!canvas) {
      setBusy(null);
      setError("Could not save that photo.");
      return;
    }
    const encoded = canvasToAvatar(canvas);
    if ("error" in encoded) {
      setBusy(null);
      setError(encoded.error);
      return;
    }
    try {
      await writeSetting(AVATAR_KEY, encoded.dataUrl);
      onClose();
    } catch {
      setError("Could not save that photo.");
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    if (busy) return;
    setBusy("remove");
    setError(null);
    try {
      await writeSetting(AVATAR_KEY, null);
      onClose();
    } catch {
      setError("Could not remove the photo.");
    } finally {
      setBusy(null);
    }
  }

  function syncPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function beginGesture() {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gesture.current = {
        kind: "pinch",
        dist: dist || 1,
        scale: scaleRef.current,
      };
      return;
    }
    if (pts.length === 1) {
      gesture.current = {
        kind: "pan",
        x: pts[0].x,
        y: pts[0].y,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
      return;
    }
    gesture.current = null;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    syncPointer(event);
    beginGesture();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    syncPointer(event);
    const current = gesture.current;
    const pts = [...pointers.current.values()];
    if (!current) return;
    if (current.kind === "pinch" && pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      applyScale(current.scale * (dist / current.dist));
      return;
    }
    if (current.kind === "pan" && pts.length === 1) {
      applyOffset(
        current.ox + (pts[0].x - current.x),
        current.oy + (pts[0].y - current.y),
      );
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    beginGesture();
  }

  function nudge(dx: number, dy: number) {
    applyOffset(offsetRef.current.x + dx, offsetRef.current.y + dy);
  }

  const frame =
    image && image.naturalWidth > 0
      ? avatarCropFrame(
          image.naturalWidth,
          image.naturalHeight,
          view,
          scale,
          offset.x,
          offset.y,
        )
      : null;
  const moved =
    Math.abs(offset.x) > 0.5 ||
    Math.abs(offset.y) > 0.5 ||
    Math.abs(scale - 1) > 0.01;
  const dirty = edited || moved;
  const canRemove = Boolean(storedSrc || image);
  const waiting = !image && !error && (reading || Boolean(storedSrc));

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={
        open
          ? "glass-dialog avatar-dialog dialog-in glass"
          : "glass-dialog avatar-dialog glass"
      }
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={requestClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          Photo
        </h2>

        <div className="mt-4 flex justify-center">
          <div
            ref={cropRef}
            className="avatar-crop"
            tabIndex={image ? 0 : -1}
            role="group"
            aria-label="Crop photo"
            aria-describedby={image ? hintId : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onKeyDown={(event) => {
              if (!image) return;
              const step = event.shiftKey ? 16 : 8;
              const delta: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              };
              const next = delta[event.key];
              if (!next) return;
              event.preventDefault();
              nudge(next[0], next[1]);
            }}
          >
            {frame && image ? (
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  width: frame.width,
                  height: frame.height,
                  left: frame.left,
                  top: frame.top,
                }}
              />
            ) : (
              <span className="text-4xl font-semibold tracking-tight text-muted">
                {waiting ? "" : profileInitial(name, email)}
              </span>
            )}
          </div>
        </div>

        {image ? (
          <p
            id={hintId}
            className="mt-2 text-center text-[13px] leading-relaxed text-muted"
          >
            Drag to move.
            <span className="sr-only"> Arrow keys nudge the photo.</span>
          </p>
        ) : (
          <p className="mt-2 text-center text-[13px] leading-relaxed text-muted">
            {waiting ? "Reading photo…" : "No photo"}
          </p>
        )}

        {image ? (
          <label className="mt-4 flex flex-col gap-1">
            <span className="text-[13px] font-medium text-muted">Size</span>
            <input
              className="avatar-size"
              type="range"
              min={AVATAR_SCALE_MIN}
              max={AVATAR_SCALE_MAX}
              step={0.01}
              value={scale}
              aria-valuetext={`${Math.round(scale * 100)} percent`}
              disabled={busy !== null}
              onChange={(event) => applyScale(Number(event.target.value))}
            />
          </label>
        ) : null}

        {error ? (
          <p className="mt-3 text-[13px] leading-relaxed text-ink" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {image ? (
            <button
              type="button"
              className="btn-primary h-12 w-full rounded-pill bg-accent text-sm font-medium text-bg hover:bg-ink disabled:opacity-40"
              disabled={!dirty || busy !== null || reading}
              onClick={() => void onSave()}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          ) : null}

          <div className={image ? "grid grid-cols-2 gap-2" : ""}>
            <button
              type="button"
              className={
                image
                  ? "glass-btn h-12 w-full rounded-pill text-sm font-medium text-ink disabled:opacity-40"
                  : "btn-primary h-12 w-full rounded-pill bg-accent text-sm font-medium text-bg hover:bg-ink disabled:opacity-40"
              }
              disabled={busy !== null || reading}
              autoFocus={!image}
              onClick={() => fileRef.current?.click()}
            >
              {reading ? "Reading photo…" : image ? "Upload new" : "Choose photo"}
            </button>
            {image ? (
              <button
                type="button"
                className="glass-btn h-12 w-full rounded-pill text-sm font-medium text-ink disabled:opacity-40"
                disabled={busy !== null || reading}
                onClick={() => void onRotate()}
              >
                Rotate
              </button>
            ) : null}
          </div>

          {canRemove ? (
            <button
              type="button"
              className="h-11 w-full text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
              disabled={busy !== null}
              onClick={() => void onRemove()}
            >
              {busy === "remove" ? "Removing…" : "Remove photo"}
            </button>
          ) : null}

          <button
            type="button"
            className="h-11 w-full text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
            disabled={busy !== null}
            onClick={requestClose}
          >
            Cancel
          </button>
        </div>

        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </div>
    </dialog>,
    document.body,
  );
}

async function rotateClockwise(
  image: HTMLImageElement,
): Promise<{ image: HTMLImageElement; revoke: () => void } | { error: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const ctx = canvas.getContext("2d");
  if (!ctx || image.naturalWidth < 1 || image.naturalHeight < 1) {
    return { error: "Could not rotate that photo." };
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92);
  });
  if (!blob) return { error: "Could not rotate that photo." };
  const url = URL.createObjectURL(blob);
  try {
    const next = await loadImage(url);
    return { image: next, revoke: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return { error: "Could not rotate that photo." };
  }
}
