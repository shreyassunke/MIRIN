import { Component, type ReactNode } from "react";

let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") {
    cached = false;
    return false;
  }
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

export class ChunkErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { err: boolean }
> {
  state = { err: false };

  static getDerivedStateFromError() {
    return { err: true };
  }

  render() {
    return this.state.err ? this.props.fallback : this.props.children;
  }
}
