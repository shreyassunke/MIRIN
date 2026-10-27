/** Who owns a pointer that landed on the profile plot. */
export type PhysiqueRole = "pass" | "figure";

/**
 * The plot owns the pointer stream so a drag on empty chart can scrub.
 * The figure still receives the gestures that start on its body.
 */
export type PhysiqueGesture = {
  down: (event: PointerEvent) => PhysiqueRole;
  move: (event: PointerEvent) => PhysiqueRole;
  up: (event: PointerEvent) => PhysiqueRole;
  wheel: (event: WheelEvent) => void;
  /** A tap that missed the body. Clears the selected region. */
  tap: (clientX: number, clientY: number) => void;
  /** True once a turn, pan, or pinch has claimed the gesture. */
  blocksScroll: () => boolean;
};

/** The plot is the capture target while the figure is turning or pinching. */
export type PhysiqueControl = {
  claim: (pointerId: number) => void;
  touchLock: (locked: boolean) => void;
};

/** A ref the child writes and the parent reads. React's RefObject is readonly. */
export type Slot<T> = { current: T };
