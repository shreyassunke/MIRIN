import { plateInk } from "../../lib/units";
import { formatWeight } from "../../lib/workout";

/** Raised metallic lettering: darker silver on light bumpers, lighter on dark. */
export function plateNumeralFill(hex: string) {
  return plateInk(hex) === "#0a0a0a" ? "#6e6e6e" : "#d4d4d4";
}

export function paintRaisedWeight(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  size: number,
  hex: string,
  yScale = 1,
) {
  ctx.save();
  if (yScale !== 1) {
    ctx.translate(cx, cy);
    ctx.scale(1, yScale);
    ctx.translate(-cx, -cy);
  }
  ctx.font = `700 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const o = Math.max(0.7, size * 0.042);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillText(label, cx + o, cy + o);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillText(label, cx - o, cy - o);
  ctx.fillStyle = plateNumeralFill(hex);
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

/** Hub and Olympic bore in pixels, from the same world dims the 3D plate uses. */
export function plateChipHub(
  r: number,
  dims: { radius: number; hole: number; insert: number },
) {
  const hub = r * (dims.insert / dims.radius);
  return { hub, bore: hub * (dims.hole / dims.insert) };
}

export type PaintPlateFaceOpts = {
  wash?: boolean;
  bore?: number;
  /** Fill the disc with the bumper colour before the lip/hub language. */
  baseFill?: string;
  /** Cut the bore out so a 3D sleeve can read through the face. */
  punchBore?: boolean;
  /** Stretch glyphs on the axis the bar pose compresses. Chips stay 1. */
  numeralYScale?: number;
};

/**
 * Face-on bumper language from the reference: raised outer lip, inner
 * hub flange, chrome insert, small 3/9 numerals. No brand marks.
 * Shared by the plate chips and the loaded-bar faces.
 */
export function paintPlateChipFace(
  ctx: CanvasRenderingContext2D,
  value: number,
  hex: string,
  cx: number,
  cy: number,
  r: number,
  hub: number,
  opts: PaintPlateFaceOpts = {},
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (opts.baseFill) {
    ctx.fillStyle = opts.baseFill;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  if (opts.wash) {
    const wash = ctx.createRadialGradient(
      cx - r * 0.26,
      cy - r * 0.32,
      r * 0.05,
      cx,
      cy,
      r,
    );
    wash.addColorStop(0, "rgba(255,255,255,0.16)");
    wash.addColorStop(0.45, "rgba(255,255,255,0)");
    wash.addColorStop(1, "rgba(0,0,0,0.26)");
    ctx.fillStyle = wash;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Raised outer lip: a full annular band, then a specular on the upper-left.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2, true);
  const lip = ctx.createRadialGradient(cx, cy, r * 0.76, cx, cy, r);
  lip.addColorStop(0, "rgba(0,0,0,0.28)");
  lip.addColorStop(0.5, "rgba(255,255,255,0.1)");
  lip.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = lip;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = Math.max(1, r * 0.028);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.935, -Math.PI * 0.98, -Math.PI * 0.12);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.935, Math.PI * 0.08, Math.PI * 0.88);
  ctx.stroke();

  // Inner raised flange around the insert.
  const flangeOut = hub * 1.72;
  const flangeIn = hub * 1.18;
  ctx.beginPath();
  ctx.arc(cx, cy, flangeOut, 0, Math.PI * 2);
  ctx.arc(cx, cy, flangeIn, 0, Math.PI * 2, true);
  const flange = ctx.createRadialGradient(cx, cy, flangeIn, cx, cy, flangeOut);
  flange.addColorStop(0, "rgba(0,0,0,0.2)");
  flange.addColorStop(0.5, "rgba(255,255,255,0.1)");
  flange.addColorStop(1, "rgba(0,0,0,0.26)");
  ctx.fillStyle = flange;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = Math.max(0.7, r * 0.016);
  ctx.beginPath();
  ctx.arc(cx, cy, (flangeIn + flangeOut) / 2, -Math.PI * 0.9, -Math.PI * 0.18);
  ctx.stroke();

  const hubGrad = ctx.createRadialGradient(
    cx - hub * 0.28,
    cy - hub * 0.32,
    hub * 0.08,
    cx,
    cy,
    hub,
  );
  hubGrad.addColorStop(0, "#f4f4f6");
  hubGrad.addColorStop(0.55, "#c4c4c8");
  hubGrad.addColorStop(1, "#7c7c82");
  ctx.fillStyle = hubGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, hub, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = Math.max(0.7, r * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, hub * 0.9, -Math.PI * 0.92, -Math.PI * 0.18);
  ctx.stroke();

  // Olympic sleeve is 50 mm; the steel insert is only a thin collar
  // around that bore (2.55 / 4.0 on a 45). A smaller hole reads as a
  // pinprick, not an axle the bar can pass through.
  const bore = opts.bore ?? hub * 0.64;
  if (opts.punchBore) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx, cy, bore, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.arc(cx, cy, bore, 0, Math.PI * 2);
    ctx.fill();
  }

  const label = formatWeight(value);
  const inner = hub * 1.78;
  const outer = r * 0.76;
  const band = Math.max(outer - inner, r * 0.1);
  const size = Math.max(
    6,
    Math.round(
      Math.min(
        r * (label.length >= 4 ? 0.14 : 0.19),
        band * (label.length >= 3 ? 0.62 : 0.88),
      ),
    ),
  );
  const xOff = inner + band * 0.55;
  const halfW = size * label.length * 0.32;
  const yScale = opts.numeralYScale ?? 1;
  if (xOff - halfW < hub * 1.12) {
    paintRaisedWeight(ctx, label, cx + xOff, cy, size, hex, yScale);
  } else {
    paintRaisedWeight(ctx, label, cx - xOff, cy, size, hex, yScale);
    paintRaisedWeight(ctx, label, cx + xOff, cy, size, hex, yScale);
  }
  ctx.restore();
}
