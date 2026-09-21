/**
 * Phosphor Icons (MIT) — https://phosphoricons.com
 * Regular + fill path pairs, stacked so selection can bloom from outline to solid.
 * History uses the cropped reference raster instead of a drawn glyph.
 */

export type NavGlyphSpec =
  | {
      outline: string;
      fill: string;
      outlineEvenodd?: boolean;
      fillEvenodd?: boolean;
    }
  | {
      outlineImage: string;
      fillImage: string;
    };

export const NAV_GLYPHS = {
  today: {
    outlineEvenodd: true,
    outline:
      "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z",
    fill: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,48H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z",
  },
  history: {
    outlineImage: "/icons/history-clock-outline.png",
    fillImage: "/icons/history-clock.png",
  },
  log: {
    outlineEvenodd: true,
    outline:
      "M184,112a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h64A8,8,0,0,1,184,112Zm-8,24H112a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm48-88V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM48,208H72V48H48Zm160,0V48H88V208H208Z",
    fill: "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM80,208H48V48H80Zm96-56H112a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H112a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z",
  },
  split: {
    outlineEvenodd: true,
    outline:
      "M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z",
    fill: "M224,152v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a16,16,0,0,1,16-16H208A16,16,0,0,1,224,152ZM208,48H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Z",
  },
  profile: {
    fillEvenodd: true,
    outline:
      "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.75,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.75,88,88,0,1,1,131.52,0Z",
    fill: "M172,120a44,44,0,1,1-44-44A44.05,44.05,0,0,1,172,120Zm60,8A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.09,88.09,0,0,0-91.47-87.93C77.43,41.89,39.87,81.12,40,128.25a87.65,87.65,0,0,0,22.24,58.16A79.71,79.71,0,0,1,84,165.1a4,4,0,0,1,4.83.32,59.83,59.83,0,0,0,78.28,0,4,4,0,0,1,4.83-.32,79.71,79.71,0,0,1,21.79,21.31A87.62,87.62,0,0,0,216,128Z",
  },
} satisfies Record<string, NavGlyphSpec>;

export function NavGlyph({
  glyph,
  active,
  animate = false,
  className,
}: {
  glyph: NavGlyphSpec;
  active: boolean;
  animate?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "nav-glyph",
        active ? "nav-glyph-on" : "",
        animate ? "nav-glyph-animate" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {"outlineImage" in glyph ? (
        <>
          <img
            src={glyph.outlineImage}
            alt=""
            draggable={false}
            className="nav-glyph-layer nav-glyph-outline nav-glyph-raster"
          />
          <img
            src={glyph.fillImage}
            alt=""
            draggable={false}
            className="nav-glyph-layer nav-glyph-fill nav-glyph-raster"
          />
        </>
      ) : (
        <>
          <svg viewBox="0 0 256 256" className="nav-glyph-layer nav-glyph-outline">
            <path
              d={glyph.outline}
              fill="currentColor"
              fillRule={glyph.outlineEvenodd ? "evenodd" : "nonzero"}
            />
          </svg>
          <svg viewBox="0 0 256 256" className="nav-glyph-layer nav-glyph-fill">
            <path
              d={glyph.fill}
              fill="currentColor"
              fillRule={glyph.fillEvenodd ? "evenodd" : "nonzero"}
            />
          </svg>
        </>
      )}
    </span>
  );
}
