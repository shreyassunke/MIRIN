import { createContext } from "react";
import type { SpectrumAnchor } from "../lib/spectrum";

/** The live pair, plus the anchors the reel tints against. Null stays ink. */
export interface FigureSpectrumValue {
  anchor: SpectrumAnchor;
  weight: number;
  reps: number;
}

export const FigureSpectrumContext = createContext<FigureSpectrumValue | null>(null);
