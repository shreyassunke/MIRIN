import type { ReactNode } from "react";
import type { GymMachineId } from "../lib/library";

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function Mark({ id }: { id: GymMachineId }) {
  switch (id) {
    case "pec-deck":
      return (
        <Frame>
          <path {...stroke} d="M12 12 5 6.5M12 12 19 6.5M12 12v5M8 18h8" />
        </Frame>
      );
    case "seated-dip":
      return (
        <Frame>
          <path {...stroke} d="M7 6.5v6.5M17 6.5v6.5M5.5 6.5h3M15.5 6.5h3M8 18h8" />
        </Frame>
      );
    case "lat-pulldown":
      return (
        <Frame>
          <path {...stroke} d="M4 5h16M12 5v4.5M5.5 9.5h13M9.5 17h5" />
        </Frame>
      );
    case "seated-row":
      return (
        <Frame>
          <path {...stroke} d="M2 16.5h11M11.5 16.5V8.5M11.5 11h8" />
        </Frame>
      );
    case "t-bar-row":
      return (
        <Frame>
          <path {...stroke} d="M12 18.5V9.5M6.5 9.5h11M8 5.5h8" />
        </Frame>
      );
    case "lateral-raise":
      return (
        <Frame>
          <path {...stroke} d="M12 16.5 5.5 8M12 16.5 18.5 8M4 6.5h3.5M16.5 6.5H20M9 19h6" />
        </Frame>
      );
    case "preacher":
      return (
        <Frame>
          <path {...stroke} d="M7 18 15 6.5M10.5 18.5 18.5 7M5 16.5h4" />
        </Frame>
      );
    case "leg-extension":
      return (
        <Frame>
          <path {...stroke} d="M4.5 7.5V14H11M11 14h7.5M18.5 12v4.5" />
        </Frame>
      );
    case "leg-curl":
      return (
        <Frame>
          <path {...stroke} d="M3 15.5h12M15 15.5V9M13 9h4.5" />
        </Frame>
      );
    case "leg-press":
      return (
        <Frame>
          <path {...stroke} d="M4 19.5 14 6.5M8 20 18 7M14 6.5 19.5 11" />
        </Frame>
      );
    case "calf-raise":
      return (
        <Frame>
          <path {...stroke} d="M7 6h3.2M13.8 6H17M8.2 6v3M15.4 6v3M6.5 9h11M5 17.5h14M8 17.5v-4M16 17.5v-4" />
        </Frame>
      );
    case "inner-thigh":
      return (
        <Frame>
          <path {...stroke} d="M6.5 7.5h11M8.5 10.5 11.4 18M15.5 10.5 12.6 18" />
        </Frame>
      );
    case "outer-thigh":
      return (
        <Frame>
          <path {...stroke} d="M6.5 7.5h11M10 10.5 5.5 18M14 10.5 18.5 18" />
        </Frame>
      );
    case "chest-press":
      return (
        <Frame>
          <path {...stroke} d="M6 18h12M8 18V8h8v6M5 10h4M15 10h4" />
        </Frame>
      );
    case "shoulder-press":
      return (
        <Frame>
          <path {...stroke} d="M4 20V5.5h3.2V20M9.2 20v-7h6.2V7.2M8 6.8h11M7.2 6.8v2.2M17.6 6.8v2.2" />
        </Frame>
      );
    case "cable":
      return (
        <Frame>
          <path {...stroke} d="M5 4v16M19 4v16M5 5.5h14M5 9h3M5 12.5h3M16 9h3M16 12.5h3" />
        </Frame>
      );
  }
}

export function MachineMark({ id }: { id: GymMachineId }) {
  return <Mark id={id} />;
}
