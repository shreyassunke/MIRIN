import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { InputModeOption } from "../../lib/library";
import type { InputMethod, Unit } from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { usePagerGesture } from "../../hooks/usePagerGesture";
import { Stepper } from "../Stepper";

export interface LoadInstrumentPage {
  id: InputMethod;
  label: string;
  weight: number;
  weightDisplay?: ReactNode;
  /** Quiet gloss after the unit — e.g. "per hand" for a pair of bells. */
  qualifier?: string;
  onQualifierClick?: () => void;
  qualifierAria?: string;
  stage?: ReactNode;
  extras?: ReactNode;
}

interface LoadInstrumentProps {
  unit: Unit;
  modes: InputModeOption[];
  mode: InputMethod;
  onModeChange: (mode: InputMethod) => void;
  pages: LoadInstrumentPage[];
  /** Larger hit target than the cluster — typically the open exercise card. */
  fieldRef?: RefObject<HTMLElement | null>;
  /** Live set count — sits on the weight line as `× 8`, same language as the chips. */
  reps?: number;
  onRepsChange?: (reps: number) => void;
  /** Finger-drag between equipment pages. Chevrons stay either way. */
  swipe?: boolean;
}

/** Active page height, blended while a swipe is between pages. */
function heightAt(progress: number, heights: number[], reduced: boolean) {
  const n = heights.length;
  if (n === 0) return 0;
  const clamped = Math.max(0, Math.min(n - 1, progress));
  if (reduced) return heights[Math.round(clamped)] ?? 0;
  const i = Math.floor(clamped);
  const t = clamped - i;
  const a = heights[i] ?? 0;
  const b = heights[Math.min(n - 1, i + 1)] ?? a;
  return a + (b - a) * t;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}


function SetReps({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <span
        className="mx-1.5 select-none text-3xl font-semibold tracking-tight text-muted"
        aria-hidden="true"
      >
        ×
      </span>
      <Stepper
        label="Reps"
        value={value}
        step={1}
        min={1}
        layout="readout"
        size="lead"
        inlineSuffix="reps"
        onChange={onChange}
      />
    </>
  );
}

function WeightHeader({
  unit,
  weight,
  weightDisplay,
  qualifier,
  onQualifierClick,
  qualifierAria,
  reps,
  onRepsChange,
}: {
  unit: Unit;
  weight: number;
  weightDisplay?: ReactNode;
  qualifier?: string;
  onQualifierClick?: () => void;
  qualifierAria?: string;
  reps?: number;
  onRepsChange?: (reps: number) => void;
}) {
  const count =
    reps != null && onRepsChange ? (
      <SetReps value={reps} onChange={onRepsChange} />
    ) : null;

  const gloss = qualifier ? (
    onQualifierClick ? (
      <button
        type="button"
        onClick={onQualifierClick}
        aria-label={qualifierAria ?? qualifier}
        className="ml-1.5 min-h-11 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
      >
        {qualifier}
      </button>
    ) : (
      <span className="ml-1.5 text-[13px] text-muted">{qualifier}</span>
    )
  ) : null;

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-center whitespace-nowrap">
      {weightDisplay ?? (
        <>
          <span className="tnum text-3xl font-semibold tracking-tight">
            {formatWeight(weight)}
          </span>
          <span className="ml-1.5 text-sm text-muted">{unit}</span>
        </>
      )}
      {gloss}
      {count}
    </div>
  );
}

/** Other methods only — the instrument already names the current one. */
function EquipmentSwitch({
  options,
  current,
  onPick,
}: {
  options: { id: string; label: string }[];
  current: string;
  onPick: (id: string) => void;
}) {
  const others = options.filter((option) => option.id !== current);
  if (others.length === 0) return null;
  return (
    <div className="flex items-center justify-center">
      {others.map((option, i) => (
        <span key={option.id} className="contents">
          {i > 0 ? (
            <span className="text-[13px] text-muted" aria-hidden="true">
              ·
            </span>
          ) : null}
          <button
            type="button"
            data-no-pager=""
            onClick={() => onPick(option.id)}
            className="min-h-11 px-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            {option.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function LoadInstrument({
  unit,
  modes,
  mode,
  onModeChange,
  pages,
  fieldRef,
  reps,
  onRepsChange,
  swipe = true,
}: LoadInstrumentProps) {
  const visible = pages.filter((page) => modes.some((m) => m.id === page.id));
  const index = Math.max(
    0,
    visible.findIndex((page) => page.id === mode),
  );
  const paging = visible.length > 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heights = useRef<number[]>([]);
  const suppressClick = useRef(false);
  const progressRef = useRef(index);
  const draggingRef = useRef(false);

  const paint = useCallback(
    (progress: number, dragging: boolean) => {
      progressRef.current = progress;
      const track = trackRef.current;
      const viewport = viewportRef.current;
      const reduced = prefersReducedMotion();
      if (track) {
        const x = reduced ? -Math.round(progress) * 100 : -progress * 100;
        track.style.transform = `translate3d(${x}%, 0, 0)`;
      }
      pageRefs.current.forEach((page, i) => {
        if (!page) return;
        if (reduced) {
          page.style.transform = "none";
          page.style.opacity =
            Math.abs(i - Math.round(progress)) < 0.5 ? "1" : "0";
          return;
        }
        const delta = i - progress;
        const abs = Math.abs(delta);
        const clamped = Math.max(-1, Math.min(1, delta));
        page.style.transform = `rotateY(${clamped * -12}deg) scale(${1 - Math.min(abs, 1) * 0.05})`;
        page.style.opacity = String(1 - Math.min(abs, 1) * 0.32);
      });
      const h = heightAt(progress, heights.current, reduced);
      if (viewport && h > 0) viewport.style.height = `${Math.round(h)}px`;
      if (dragging) suppressClick.current = true;
      draggingRef.current = dragging;
      const field = (fieldRef ?? rootRef).current;
      const inMotion =
        dragging || Math.abs(progress - Math.round(progress)) > 0.001;
      field?.classList.toggle("is-paging", inMotion);
    },
    [fieldRef],
  );

  const measure = useCallback(() => {
    const next: number[] = [];
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      next[i] = page.scrollHeight;
    });
    heights.current = next;
    paint(progressRef.current, draggingRef.current);
  }, [paint]);

  const { goTo } = usePagerGesture({
    count: visible.length,
    index,
    enabled: paging && swipe,
    rootRef: fieldRef ?? rootRef,
    onProgress: paint,
    onIndexChange: (next) => {
      const page = visible[next];
      if (page && page.id !== mode) onModeChange(page.id);
    },
    getWidth: () => viewportRef.current?.clientWidth ?? 1,
  });

  const aim = useRef(index);
  useEffect(() => {
    aim.current = index;
  }, [index]);

  useLayoutEffect(() => {
    measure();
    const observers = pageRefs.current.map((page) => {
      if (!page) return null;
      const ro = new ResizeObserver(measure);
      ro.observe(page);
      return ro;
    });
    return () => observers.forEach((ro) => ro?.disconnect());
  }, [measure, visible.map((page) => page.id).join(":")]);

  useLayoutEffect(() => {
    const field = (fieldRef ?? rootRef).current;
    if (!field) return;
    const onClick = (event: MouseEvent) => {
      if (!suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    };
    field.addEventListener("click", onClick, true);
    return () => field.removeEventListener("click", onClick, true);
  }, [fieldRef]);

  const methodLabel = visible[index]?.label ?? "weight";

  useEffect(() => {
    const field = (fieldRef ?? rootRef).current;
    if (!field || !paging || !swipe) return;
    field.tabIndex = 0;
    field.setAttribute("role", "region");
    field.setAttribute(
      "aria-label",
      `Weight input, ${methodLabel}. Other methods are listed under the instrument.`,
    );
    return () => {
      field.removeAttribute("role");
      field.removeAttribute("aria-label");
      field.removeAttribute("tabindex");
    };
  }, [fieldRef, methodLabel, paging, swipe]);

  const body = (page: LoadInstrumentPage, live = false) => (
    <div
      className="flex flex-col gap-2"
      aria-live={live ? "polite" : undefined}
    >
      <WeightHeader
        unit={unit}
        weight={page.weight}
        weightDisplay={page.weightDisplay}
        qualifier={page.qualifier}
        onQualifierClick={page.onQualifierClick}
        qualifierAria={page.qualifierAria}
        reps={reps}
        onRepsChange={onRepsChange}
      />
      {page.stage}
      {page.extras}
    </div>
  );

  const switcher = paging ? (
    <EquipmentSwitch
      options={visible.map((page) => ({ id: page.id, label: page.label }))}
      current={visible[index]?.id ?? mode}
      onPick={(id) => {
        const next = visible.findIndex((page) => page.id === id);
        if (next < 0) return;
        aim.current = next;
        goTo(next);
      }}
    />
  ) : null;

  if (!paging) {
    const page = visible[0];
    if (!page) return null;
    return (
      <div className="flex flex-col gap-1">
        {body(page, true)}
        {switcher}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div ref={rootRef} className="load-pager-root">
        <div ref={viewportRef} className="load-pager">
          <div ref={trackRef} className="load-pager-track">
            {visible.map((page, i) => {
              const active = page.id === mode;
              return (
                <div
                  key={page.id}
                  ref={(el) => {
                    pageRefs.current[i] = el;
                  }}
                  className="load-pager-page"
                  aria-hidden={!active}
                  {...(!active ? { inert: "" } : {})}
                >
                  {body(page, active)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {switcher}
    </div>
  );
}
