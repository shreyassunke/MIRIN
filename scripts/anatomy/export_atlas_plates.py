"""Atlas plates for muscles BodyParts3D 4.0 does not name.

Latissimus dorsi and rectus abdominis have no element file in the IS-A
table. The outlines already shipped in src/lib/anatomy.generated.ts are
the flutter-body-atlas plates (CC BY 4.0). This step samples those curves
into the same shared-frame SVG the OBJ composer writes, with the tendon
on the right so the strand fan can use them.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "src" / "lib" / "anatomy.generated.ts"
OUT = ROOT / "public" / "anatomy"
LONG_SIDE = 1000.0
PAD = 40.0


def path_for(source: str, name: str) -> str:
    match = re.search(rf'"{re.escape(name)}": "([^"]+)"', source)
    if not match:
        raise SystemExit(f"missing atlas path {name}")
    return match.group(1)


def flatten(d: str, steps: int = 7) -> list[list[tuple[float, float]]]:
    tokens = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?", d, flags=re.I)
    rings: list[list[tuple[float, float]]] = []
    ring: list[tuple[float, float]] = []
    command = ""
    cx = cy = 0.0
    index = 0

    def emit(x: float, y: float) -> None:
        nonlocal cx, cy
        ring.append((x, y))
        cx, cy = x, y

    while index < len(tokens):
        token = tokens[index]
        if re.fullmatch(r"[MLCZ]", token, flags=re.I):
            command = token.upper()
            index += 1
            if command == "Z" and len(ring) > 2:
                rings.append(ring)
                ring = []
            continue
        if command == "M":
            if len(ring) > 2:
                rings.append(ring)
            ring = []
            x, y = float(tokens[index]), float(tokens[index + 1])
            index += 2
            emit(x, y)
            command = "L"
        elif command == "L":
            x, y = float(tokens[index]), float(tokens[index + 1])
            index += 2
            emit(x, y)
        elif command == "C":
            nums = [float(tokens[index + offset]) for offset in range(6)]
            index += 6
            x1, y1, x2, y2, x, y = nums
            x0, y0 = cx, cy
            for step in range(1, steps + 1):
                t = step / steps
                u = 1 - t
                emit(
                    u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
                    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
                )
        else:
            index += 1
    if len(ring) > 2:
        rings.append(ring)
    return rings


def as_path(ring: list[tuple[float, float]]) -> str:
    head, *rest = ring
    parts = [f"M {head[0]:.2f} {head[1]:.2f}"]
    parts.extend(f"L {x:.2f} {y:.2f}" for x, y in rest)
    parts.append("Z")
    return " ".join(parts)


def frame(heads: dict[str, list[tuple[float, float]]], flip: str) -> dict:
    """flip is how atlas x/y (y down) become the plate, tendon on the right."""

    def map_point(x: float, y: float) -> tuple[float, float]:
        if flip == "lat":
            # Back-view left lat: the arm is the smaller x. Negate so it sits right.
            return (-x, y)
        # Rectus: fibers run vertical. Superior (small y) is the costal insertion.
        return (-y, x)

    mapped = {key: [map_point(x, y) for x, y in ring] for key, ring in heads.items()}
    flat = [point for ring in mapped.values() for point in ring]
    min_x = min(point[0] for point in flat)
    max_x = max(point[0] for point in flat)
    min_y = min(point[1] for point in flat)
    max_y = max(point[1] for point in flat)
    span_x = max(max_x - min_x, 1e-9)
    span_y = max(max_y - min_y, 1e-9)
    scale = LONG_SIDE / max(span_x, span_y)

    def project(x: float, y: float) -> tuple[float, float]:
        return ((x - min_x) * scale + PAD, (max_y - y) * scale + PAD)

    projected = {key: [project(x, y) for x, y in ring] for key, ring in mapped.items()}
    # Outline is the heads drawn in one frame. A single head uses itself.
    # Several heads keep their own rings; the outline is every ring so the
    # fan can cross a gap only where a head actually is. The union used by
    # the strand field is the largest ring when there is one head, and the
    # concatenated outer rings otherwise — FiberStrands wants one ring, so
    # build a bbox-free convex-ish union by taking all points' silhouette
    # as the heads themselves stacked. One closed outline: the bounding
    # ring of every projected point is too crude. Use the first head's
    # ring when alone, else a manual union path of each head (multi-ring).
    width = span_x * scale + PAD * 2
    height = span_y * scale + PAD * 2
    return {
        "heads": {key: as_path(ring) for key, ring in projected.items()},
        "viewWidth": round(width, 2),
        "viewHeight": round(height, 2),
    }


def write_svg(group_id: str, source_note: str, composed: dict, outline: str) -> None:
    path = OUT / "svg" / f"{group_id}.svg"
    path.parent.mkdir(parents=True, exist_ok=True)
    width = composed["viewWidth"]
    height = composed["viewHeight"]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f"<!-- {source_note} See ../LICENSES.md. Not a measurement. -->",
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {width:.2f} {height:.2f}" '
            f'data-muscle-id="{group_id}" data-source="flutter-body-atlas">'
        ),
        f'  <path id="outline" fill="none" stroke="#000" d="{outline}" />',
    ]
    for head_id, d in composed["heads"].items():
        lines.append(f'  <path id="{head_id}" data-role="head" fill="none" stroke="none" d="{d}" />')
    lines.append("</svg>")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def remember(group_id: str, members: list[str], composed: dict) -> None:
    anchors_path = OUT / "anchors.json"
    payload = json.loads(anchors_path.read_text(encoding="utf-8"))
    payload.setdefault("groups", {})[group_id] = {
        "members": members,
        "viewBox": [0, 0, composed["viewWidth"], composed["viewHeight"]],
        "viewAxis": "atlas",
        "planeAxes": ["x", "y"],
        "anchors": "shared-frame",
        "tendon": "lateral" if group_id == "latissimus_dorsi" else "proximal",
        "source": "flutter-body-atlas",
    }
    anchors_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    text = ATLAS.read_text(encoding="utf-8")
    back = text.split("export const BACK_PATHS", 1)[1].split("export const ATLAS_REGIONS", 1)[0]
    front = text.split("export const FRONT_PATHS", 1)[1].split("export const BACK_PATHS", 1)[0]

    lat_rings = flatten(path_for(back, "latissimus_dorsi_l"))
    lat_ring = max(lat_rings, key=len)
    lat = frame({"latissimus_dorsi": lat_ring}, "lat")
    write_svg(
        "latissimus_dorsi",
        "Derivative outline of latissimus dorsi from the flutter-body-atlas posterior plate (Ryan Graves, CC BY 4.0). BodyParts3D 4.0 has no named latissimus element.",
        lat,
        lat["heads"]["latissimus_dorsi"],
    )
    remember("latissimus_dorsi", ["latissimus_dorsi"], lat)

    upper = max(flatten(path_for(front, "rectus_abdominis_4_l")), key=len)
    middle_parts = flatten(path_for(front, "rectus_abdominis_3_l")) + flatten(
        path_for(front, "rectus_abdominis_2_l")
    )
    middle = max(middle_parts, key=len)
    lower_all = max(flatten(path_for(front, "rectus_abdominis_1")), key=len)
    # The lower belly is one midline shape. Left is the higher x on this plate.
    lower = [point for point in lower_all if point[0] >= 290]
    if len(lower) < 4:
        lower = lower_all
    rectus = frame(
        {
            "rectus_abdominis_upper": upper,
            "rectus_abdominis_middle": middle,
            "rectus_abdominis_lower": lower,
        },
        "rectus",
    )
    # One outline the fan can fill: the three bands stacked, as separate
    # subpaths. parseOutline keeps the first ring, so the outline has to be
    # a single ring that contains the bands. Build it from every projected
    # head point's axis-aligned... no, that would be a box. Re-read the
    # written head paths and use a convex hull instead.
    hull = convex([point for d in rectus["heads"].values() for point in parse_written(d)])
    write_svg(
        "rectus_abdominis",
        "Derivative outline of rectus abdominis from the flutter-body-atlas anterior plate (Ryan Graves, CC BY 4.0). BodyParts3D 4.0 has no named rectus element. Bands are the upper, middle, and lower segments of the left side.",
        rectus,
        as_path(hull),
    )
    remember(
        "rectus_abdominis",
        ["rectus_abdominis_upper", "rectus_abdominis_middle", "rectus_abdominis_lower"],
        rectus,
    )
    print("wrote latissimus_dorsi and rectus_abdominis")


def parse_written(d: str) -> list[tuple[float, float]]:
    nums = [float(token) for token in re.findall(r"-?\d*\.?\d+", d)]
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]


def convex(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    ordered = sorted(set(points))
    if len(ordered) < 3:
        return ordered

    def cross(o, a, b) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for point in ordered:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper: list[tuple[float, float]] = []
    for point in reversed(ordered):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


if __name__ == "__main__":
    main()
