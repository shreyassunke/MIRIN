import type { Implement, LiftPose } from "../lib/liftPose";
import { liftMark } from "../lib/liftPose";

const ink = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ImplementGlyph({ implement }: { implement: Implement }) {
  switch (implement) {
    case "dumbbell":
      return (
        <g>
          <line x1="12" y1="16" x2="20" y2="16" {...ink} />
          <rect x="7" y="12.25" width="4.2" height="7.5" rx="1.15" {...ink} />
          <rect x="20.8" y="12.25" width="4.2" height="7.5" rx="1.15" {...ink} />
        </g>
      );
    case "kettlebell":
      return (
        <g>
          <path d="M12.2 14.2a3.8 3.8 0 0 1 7.6 0" {...ink} />
          <circle cx="16" cy="19.2" r="4.6" {...ink} />
        </g>
      );
    case "cable":
      return (
        <g>
          <circle cx="16" cy="7.5" r="2" {...ink} />
          <line x1="16" y1="9.5" x2="16" y2="20" {...ink} />
          <line x1="11" y1="20" x2="21" y2="20" {...ink} />
        </g>
      );
    case "machine":
      return (
        <g>
          <rect x="8" y="7" width="16" height="18" rx="1.6" {...ink} />
          <line x1="8" y1="16" x2="24" y2="16" {...ink} />
        </g>
      );
    case "body":
      return (
        <g>
          <line x1="7" y1="9" x2="25" y2="9" {...ink} />
          <line x1="10" y1="9" x2="10" y2="13" {...ink} />
          <line x1="22" y1="9" x2="22" y2="13" {...ink} />
          <path d="M12 13.5 L16 18 L20 13.5" {...ink} />
          <path d="M16 18 L13 26 M16 18 L19 26" {...ink} />
        </g>
      );
    default:
      return (
        <g>
          <line x1="5" y1="16" x2="27" y2="16" {...ink} />
          <line x1="8.5" y1="11.2" x2="8.5" y2="20.8" {...ink} />
          <line x1="11.2" y1="12.8" x2="11.2" y2="19.2" {...ink} />
          <line x1="20.8" y1="12.8" x2="20.8" y2="19.2" {...ink} />
          <line x1="23.5" y1="11.2" x2="23.5" y2="20.8" {...ink} />
        </g>
      );
  }
}

function BenchLoad({
  implement,
  tilt,
}: {
  implement: Implement;
  tilt: number;
}) {
  return (
    <g transform={`rotate(${tilt} 16 20)`}>
      <line x1="5" y1="23.5" x2="27" y2="23.5" {...ink} />
      <g transform="translate(0 -9)">
        <ImplementGlyph implement={implement} />
      </g>
    </g>
  );
}

function Scene({ pose, implement }: { pose: LiftPose; implement: Implement }) {
  if (pose === "incline") {
    return (
      <g>
        <line x1="3" y1="26" x2="29" y2="14" {...ink} />
        <g transform="translate(16 12) rotate(-25) translate(-16 -16)">
          <ImplementGlyph implement={implement} />
        </g>
      </g>
    );
  }
  if (pose === "decline") return <BenchLoad implement={implement} tilt={16} />;
  if (pose === "press") {
    if (implement === "machine" || implement === "cable") {
      return <ImplementGlyph implement={implement} />;
    }
    return <BenchLoad implement={implement} tilt={0} />;
  }
  if (pose === "overhead") {
    return (
      <g>
        <g transform="translate(0 -5) rotate(-90 16 16)">
          <ImplementGlyph implement={implement === "body" ? "barbell" : implement} />
        </g>
        <line x1="11" y1="25" x2="21" y2="25" {...ink} />
      </g>
    );
  }
  if (pose === "curl") {
    return (
      <g transform="rotate(46 16 17)">
        <ImplementGlyph implement={implement === "body" ? "dumbbell" : implement} />
      </g>
    );
  }
  if (pose === "row") {
    return (
      <g>
        <line x1="6" y1="9" x2="26" y2="9" {...ink} />
        <g transform="translate(0 7)">
          <ImplementGlyph implement={implement} />
        </g>
      </g>
    );
  }
  if (pose === "pulldown") {
    if (implement === "body") return <ImplementGlyph implement="body" />;
    return (
      <g>
        <line x1="5" y1="6" x2="27" y2="6" {...ink} />
        <line x1="16" y1="6" x2="16" y2="18" {...ink} />
        <line x1="9" y1="18" x2="23" y2="18" {...ink} />
      </g>
    );
  }
  if (pose === "fly") {
    return (
      <g>
        <path d="M8 22 C11 13, 14 11, 16 11" {...ink} />
        <path d="M24 22 C21 13, 18 11, 16 11" {...ink} />
        <circle cx="8" cy="22" r="1.7" {...ink} />
        <circle cx="24" cy="22" r="1.7" {...ink} />
      </g>
    );
  }
  if (pose === "raise") {
    return (
      <g>
        <line x1="16" y1="26" x2="16" y2="16" {...ink} />
        <g transform="translate(16 16) rotate(-58) scale(0.82) translate(-16 -16)">
          <ImplementGlyph implement={implement === "barbell" ? "dumbbell" : implement} />
        </g>
      </g>
    );
  }
  if (pose === "squat") {
    return (
      <g>
        <line x1="6" y1="8" x2="26" y2="8" {...ink} />
        <line x1="9" y1="5" x2="9" y2="11" {...ink} />
        <line x1="23" y1="5" x2="23" y2="11" {...ink} />
        <path d="M12 15 L8 21 L13 29" {...ink} />
        <path d="M20 15 L24 21 L19 29" {...ink} />
      </g>
    );
  }
  if (pose === "hinge") {
    return (
      <g>
        <path d="M22 8 L14 18 L8 22" {...ink} />
        <g transform="translate(-6 6)">
          <ImplementGlyph implement={implement === "body" ? "barbell" : implement} />
        </g>
      </g>
    );
  }
  if (pose === "lunge") {
    return (
      <g>
        <g transform="translate(16 8) scale(0.78) translate(-16 -16)">
          <ImplementGlyph implement={implement === "body" ? "barbell" : implement} />
        </g>
        <path d="M15 14 L12 20 L7 28" {...ink} />
        <path d="M15 20 L21 22 L26 28" {...ink} />
      </g>
    );
  }
  if (pose === "extension") {
    if (implement === "cable" || implement === "machine") {
      return <ImplementGlyph implement="cable" />;
    }
    return (
      <g>
        <g transform="rotate(-70 16 14)">
          <ImplementGlyph implement={implement} />
        </g>
        <line x1="12" y1="26" x2="22" y2="26" {...ink} />
      </g>
    );
  }
  if (pose === "shrug") {
    return (
      <g>
        <path d="M9 13 L16 8.5 L23 13" {...ink} />
        <ImplementGlyph implement={implement === "body" ? "barbell" : implement} />
      </g>
    );
  }
  if (pose === "calf") {
    return (
      <g>
        <g transform="translate(0 -6)">
          <ImplementGlyph implement={implement === "body" ? "barbell" : implement} />
        </g>
        <line x1="7" y1="27" x2="25" y2="27" {...ink} />
        <path d="M13 27 L14.5 18 L18 18 L21 27" {...ink} />
        <line x1="18" y1="24" x2="24" y2="24" {...ink} />
      </g>
    );
  }
  if (pose === "core") {
    return <path d="M5 23 Q12 20 16 14 T27 12" {...ink} />;
  }
  return <ImplementGlyph implement={implement} />;
}

export function LiftMark({
  name,
  equipment,
  className,
}: {
  name: string;
  equipment?: string;
  className?: string;
}) {
  const spec = liftMark(name, equipment);
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <Scene pose={spec.pose} implement={spec.implement} />
    </svg>
  );
}

export function MedalRing({
  className,
  crisp = false,
}: {
  className?: string;
  /** Row size. Strokes stay 1px / 1.5px instead of shrinking with the viewBox. */
  crisp?: boolean;
}) {
  const effect = crisp ? "non-scaling-stroke" : undefined;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="currentColor"
        strokeWidth={crisp ? 1 : 0.75}
        vectorEffect={effect}
        className="text-hairline"
      />
      <circle
        cx="50"
        cy="50"
        r="41.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={crisp ? 1.5 : 1.35}
        vectorEffect={effect}
        pathLength="1"
        className="record-ring text-ink"
      />
    </svg>
  );
}
