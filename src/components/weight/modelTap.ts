/** Travel at or under this is a tap. Past it, paging or scrolling owns the gesture. */
export const MODEL_TAP_PX = 12;

/** A tap opens the variation list. A page swipe does not. */
export function isVariationTap(travelPx: number, paging: boolean): boolean {
  return !paging && travelPx <= MODEL_TAP_PX;
}
