"""Export an orthographic muscle outline and fiber anchors.

Run headless from the repo root. The exact command is in
scripts/anatomy/README.md. This file is project code. The SVG and anchors
it writes are derivatives of the source meshes and belong in public/anatomy.

  python scripts/anatomy/export_outlines.py --self-check

That check does not load Blender. The export itself must be started with
blender --background --python.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

AXIS = ("x", "y", "z")
LONG_SIDE = 1000.0
PAD = 40.0

# English names used by BodyParts3D and, where they differ, by Z-Anatomy.
# The sternal head is BodyParts3D's sternocostal part.
NAME_HINTS = {
    "pectoralis_major_clavicular": (
        "clavicular part of left pectoralis major",
        "pectoralis major, clavicular",
        "pectoralis major clavicular",
    ),
    "pectoralis_major_sternal": (
        "sternocostal part of left pectoralis major",
        "pectoralis major, sternocostal",
        "pectoralis major, sternal",
        "pectoralis major sternal",
    ),
    "pectoralis_major_abdominal": (
        "abdominal part of left pectoralis major",
        "pectoralis major, abdominal",
        "pectoralis major abdominal",
    ),
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def cli_args(argv: list[str]) -> argparse.Namespace:
    # Blender puts its own flags in sys.argv and our flags after "--".
    # Plain Python has the script path in argv[0] and the flags after that.
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true")
    parser.add_argument(
        "--compose",
        help="Write one shared-frame outline for this muscle group. BodyParts3D OBJ only.",
    )
    parser.add_argument("--source", choices=("bodyparts3d", "z-anatomy"))
    parser.add_argument("--mesh-dir", type=Path)
    parser.add_argument("--catalog", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.004,
        help="Douglas-Peucker error as a fraction of the longer in-plane side.",
    )
    parser.add_argument(
        "--swap",
        action="append",
        default=[],
        help="Muscle id whose origin and insertion should be exchanged.",
    )
    parser.add_argument(
        "--rename",
        action="append",
        default=[],
        help='Z-Anatomy override, as id="Exact object name". Repeatable.',
    )
    args = parser.parse_args(argv)
    if not args.self_check:
        required = ("catalog", "out") if args.compose else ("source", "catalog", "out")
        missing = [name for name in required if getattr(args, name) is None]
        if args.compose or args.source == "bodyparts3d":
            if args.mesh_dir is None:
                missing.append("mesh-dir")
        if missing:
            parser.error("missing " + ", ".join("--" + name for name in missing))
    return args


def extents(verts):
    lo = [min(v[i] for v in verts) for i in range(3)]
    hi = [max(v[i] for v in verts) for i in range(3)]
    return lo, hi, [hi[i] - lo[i] for i in range(3)]


def triangles(faces):
    for face in faces:
        if len(face) < 3:
            continue
        for i in range(1, len(face) - 1):
            tri = (face[0], face[i], face[i + 1])
            if len(set(tri)) == 3:
                yield tri


RASTER = 480


def fill_triangle(mask, width, height, a, b, c):
    """Scanline fill. A sliver still stamps its vertices so thin parts survive."""
    xs = (a[0], b[0], c[0])
    ys = (a[1], b[1], c[1])
    y_start = max(0, int(math.floor(min(ys))))
    y_end = min(height - 1, int(math.ceil(max(ys))))
    ordered = sorted((a, b, c), key=lambda point: point[1])
    (x0, y0), (x1, y1), (x2, y2) = ordered

    def at(y, xa, ya, xb, yb):
        if yb == ya:
            return xa
        return xa + (y - ya) * (xb - xa) / (yb - ya)

    for y in range(y_start, y_end + 1):
        yy = y + 0.5
        if yy < y0 or yy > y2:
            continue
        long_x = at(yy, x0, y0, x2, y2)
        if yy <= y1:
            short_x = at(yy, x0, y0, x1, y1)
        else:
            short_x = at(yy, x1, y1, x2, y2)
        left, right = (long_x, short_x) if long_x < short_x else (short_x, long_x)
        x_start = max(0, int(math.floor(left)))
        x_end = min(width - 1, int(math.ceil(right)))
        row = y * width
        for x in range(x_start, x_end + 1):
            mask[row + x] = True
    for x, y in (a, b, c):
        ix = int(x)
        iy = int(y)
        if 0 <= ix < width and 0 <= iy < height:
            mask[iy * width + ix] = True


def projected_rings(plane, faces, min_x, min_y, span_x, span_y):
    """Orthographic silhouette: the outline of every triangle's shadow."""
    scale = (RASTER - 1) / max(span_x, span_y, 1e-9)
    width = max(2, int(math.ceil(span_x * scale)) + 1)
    height = max(2, int(math.ceil(span_y * scale)) + 1)
    mask = [False] * (width * height)

    def grid(x, y):
        return ((x - min_x) * scale, (y - min_y) * scale)

    for a, b, c in triangles(faces):
        fill_triangle(
            mask,
            width,
            height,
            grid(*plane[a]),
            grid(*plane[b]),
            grid(*plane[c]),
        )

    def vid(x, y):
        return y * (width + 1) + x

    points = [(0.0, 0.0)] * ((width + 1) * (height + 1))
    for y in range(height + 1):
        for x in range(width + 1):
            points[vid(x, y)] = (float(x), float(y))

    edges = []
    for y in range(height):
        row = y * width
        for x in range(width):
            if not mask[row + x]:
                continue
            if x == 0 or not mask[row + x - 1]:
                edges.append((vid(x, y), vid(x, y + 1)))
            if x == width - 1 or not mask[row + x + 1]:
                edges.append((vid(x + 1, y), vid(x + 1, y + 1)))
            if y == 0 or not mask[row - width + x]:
                edges.append((vid(x, y), vid(x + 1, y)))
            if y == height - 1 or not mask[row + width + x]:
                edges.append((vid(x, y + 1), vid(x + 1, y + 1)))

    rings = []
    for loop in chain_loops(edges, points):
        ring = []
        for index in loop:
            gx, gy = points[index]
            ring.append((min_x + gx / scale, min_y + gy / scale))
        if abs(shoelace(ring)) > 0:
            rings.append(ring)
    return rings


def chain_loops(edges, plane):
    """Walk silhouette edges into loops. At a junction, continue the smoothest turn."""
    adj: dict[int, list[int]] = {}
    for index, (u, v) in enumerate(edges):
        adj.setdefault(u, []).append(index)
        adj.setdefault(v, []).append(index)
    used = [False] * len(edges)
    loops = []

    def other(edge, vertex):
        u, v = edges[edge]
        return v if u == vertex else u

    def turn(prev, cur, nxt):
        ax, ay = plane[prev]
        bx, by = plane[cur]
        cx, cy = plane[nxt]
        ix, iy = bx - ax, by - ay
        ox, oy = cx - bx, cy - by
        il = math.hypot(ix, iy) or 1
        ol = math.hypot(ox, oy) or 1
        return (ix * ox + iy * oy) / (il * ol)

    for start_edge in range(len(edges)):
        if used[start_edge]:
            continue
        used[start_edge] = True
        u, v = edges[start_edge]
        loop = [u, v]
        prev_edge = start_edge
        cur = v
        while cur != loop[0]:
            options = []
            for edge in adj.get(cur, []):
                if used[edge] or edge == prev_edge:
                    continue
                nxt = other(edge, cur)
                score = turn(loop[-2], cur, nxt) if len(loop) >= 2 else 1
                options.append((score, edge, nxt))
            if not options:
                break
            options.sort(reverse=True)
            _, edge, nxt = options[0]
            used[edge] = True
            loop.append(nxt)
            prev_edge = edge
            cur = nxt
        if cur == loop[0] and len(loop) >= 4:
            loops.append(loop[:-1])
    return loops


def shoelace(points):
    area = 0.0
    for i, (x, y) in enumerate(points):
        nx, ny = points[(i + 1) % len(points)]
        area += x * ny - nx * y
    return area / 2


def rdp(points, epsilon):
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    span = math.hypot(bx - ax, by - ay) or 1
    worst = 0.0
    index = 0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        dist = abs((by - ay) * x - (bx - ax) * y + bx * ay - by * ax) / span
        if dist > worst:
            worst = dist
            index = i
    if worst <= epsilon:
        return [points[0], points[-1]]
    left = rdp(points[: index + 1], epsilon)
    right = rdp(points[index:], epsilon)
    return left[:-1] + right


def simplify_ring(points, epsilon):
    """Split the ring first. A closed chord has no length, so RDP would keep every point."""
    if len(points) < 4:
        return points
    origin = points[0]
    far = max(
        range(1, len(points)),
        key=lambda i: math.hypot(points[i][0] - origin[0], points[i][1] - origin[1]),
    )
    left = rdp(points[: far + 1], epsilon)
    right = rdp(points[far:] + [points[0]], epsilon)
    merged = left[:-1] + right
    if merged and merged[0] == merged[-1]:
        merged = merged[:-1]
    return merged if len(merged) >= 3 else points


def laterality_axis(verts, view_axis):
    """Axis that comes closest to the midline while staying entirely on one side.

    BodyParts3D keeps the whole body at a high Z, so height alone is not
    laterality. The left-right axis is the one-sided axis nearest zero.
    """
    lo, hi, _ = extents(verts)
    found = None
    nearest = None
    for axis in range(3):
        if axis == view_axis:
            continue
        if lo[axis] > 1:
            gap = lo[axis]
        elif hi[axis] < -1:
            gap = -hi[axis]
        else:
            continue
        if nearest is None or gap < nearest:
            found = axis
            nearest = gap
    return found


def pca_ends(points):
    count = len(points)
    mx = sum(p[0] for p in points) / count
    my = sum(p[1] for p in points) / count
    sxx = syy = sxy = 0.0
    for x, y in points:
        dx, dy = x - mx, y - my
        sxx += dx * dx
        syy += dy * dy
        sxy += dx * dy
    angle = 0.5 * math.atan2(2 * sxy, sxx - syy)
    cosine, sine = math.cos(angle), math.sin(angle)
    ranked = sorted(
        (((x - mx) * cosine + (y - my) * sine), i) for i, (x, y) in enumerate(points)
    )
    return ranked[0][1], ranked[-1][1]


def build_outline(verts, faces, tolerance: float, swap: bool):
    if len(verts) < 3 or not faces:
        raise ValueError("mesh has no surface")
    lo, hi, size = extents(verts)
    view_axis = min(range(3), key=lambda axis: size[axis])
    plane_axes = [axis for axis in range(3) if axis != view_axis]
    plane_axes.sort(key=lambda axis: size[axis], reverse=True)
    ax_x, ax_y = plane_axes
    plane = [(v[ax_x], v[ax_y]) for v in verts]
    min_x = min(p[0] for p in plane)
    max_x = max(p[0] for p in plane)
    min_y = min(p[1] for p in plane)
    max_y = max(p[1] for p in plane)
    span_x = max(max_x - min_x, 1e-9)
    span_y = max(max_y - min_y, 1e-9)
    rings = projected_rings(plane, faces, min_x, min_y, span_x, span_y)
    if not rings:
        raise ValueError("no silhouette")
    rings.sort(key=lambda pts: abs(shoelace(pts)), reverse=True)
    outer_area = abs(shoelace(rings[0]))
    kept = [rings[0]]
    for ring in rings[1:]:
        if abs(shoelace(ring)) >= outer_area * 0.02:
            kept.append(ring)

    scale = LONG_SIDE / max(span_x, span_y)
    pixel = max(span_x, span_y) / RASTER
    epsilon = max(tolerance * max(span_x, span_y), pixel * 1.25)

    def project(x, y):
        return (
            (x - min_x) * scale + PAD,
            (max_y - y) * scale + PAD,
        )

    commands = []
    for index, ring in enumerate(kept):
        simplified = simplify_ring(ring, epsilon)
        area = shoelace(simplified)
        # Outer ring is counter-clockwise in plane space. Holes are the reverse.
        if (index == 0 and area < 0) or (index > 0 and area > 0):
            simplified = list(reversed(simplified))
        mapped = [project(x, y) for x, y in simplified]
        head, *rest = mapped
        parts = [f"M {head[0]:.2f} {head[1]:.2f}"]
        parts.extend(f"L {x:.2f} {y:.2f}" for x, y in rest)
        parts.append("Z")
        commands.append(" ".join(parts))

    samples = list(range(0, len(verts), max(1, len(verts) // 4000)))
    sample_pts = [plane[i] for i in samples]
    end_a, end_b = pca_ends(sample_pts)
    index_a, index_b = samples[end_a], samples[end_b]
    side = laterality_axis(verts, view_axis)
    if side is None:
        polarity = "unsigned"
        origin_i, insertion_i = index_a, index_b
    else:
        polarity = "midline"
        origin_i, insertion_i = (
            (index_a, index_b)
            if abs(verts[index_a][side]) <= abs(verts[index_b][side])
            else (index_b, index_a)
        )
    if swap:
        origin_i, insertion_i = insertion_i, origin_i
        polarity = "swapped"

    origin = project(*plane[origin_i])
    insertion = project(*plane[insertion_i])
    width = span_x * scale + PAD * 2
    height = span_y * scale + PAD * 2
    return {
        "d": " ".join(commands),
        "viewBox": [0, 0, round(width, 2), round(height, 2)],
        "viewWidth": round(width, 2),
        "viewHeight": round(height, 2),
        "origin": [round(origin[0], 2), round(origin[1], 2)],
        "insertion": [round(insertion[0], 2), round(insertion[1], 2)],
        "viewAxis": AXIS[view_axis],
        "planeAxes": [AXIS[ax_x], AXIS[ax_y]],
        "polarity": polarity,
    }


def parse_obj(path: Path):
    verts = []
    faces = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("v "):
            _, x, y, z, *_ = line.split()
            verts.append((float(x), float(y), float(z)))
        elif line.startswith("f "):
            face = []
            for token in line.split()[1:]:
                raw = int(token.split("/")[0])
                face.append(raw - 1 if raw > 0 else len(verts) + raw)
            if len(face) >= 3:
                faces.append(face)
    return verts, faces


def write_svg(path: Path, muscle: dict, source: str, outline: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    width = outline["viewWidth"]
    height = outline["viewHeight"]
    comment = (
        f"Derivative outline of {muscle['id']} from {source}. "
        "See ../LICENSES.md. Not a measurement."
    )
    path.write_text(
        "\n".join(
            [
                '<?xml version="1.0" encoding="UTF-8"?>',
                f"<!-- {comment} -->",
                (
                    f'<svg xmlns="http://www.w3.org/2000/svg" '
                    f'viewBox="0 0 {width:.2f} {height:.2f}" '
                    f'data-muscle-id="{muscle["id"]}" data-source="{source}" '
                    f'data-mesh-id="{muscle["meshId"]}" '
                    f'data-element-id="{muscle.get("elementId", "")}">'
                ),
                f'  <path id="outline" fill="none" stroke="#000" d="{outline["d"]}" />',
                "</svg>",
                "",
            ]
        ),
        encoding="utf-8",
    )


def self_check() -> bool:
    """A thin box on +X must outline as one ring, origin nearer the midline."""
    xs = (10.0, 40.0)
    ys = (0.0, 2.0)
    zs = (0.0, 20.0)
    corners = [(x, y, z) for x in xs for y in ys for z in zs]
    quads = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    outline = build_outline(corners, [list(q) for q in quads], 0.004, False)
    if outline["viewAxis"] != "y":
        print(f"self-check: expected view axis y, got {outline['viewAxis']}")
        return False
    if outline["d"].count("Z") != 1:
        print("self-check: expected one closed ring")
        return False
    if not (outline["origin"][0] < outline["insertion"][0]):
        print("self-check: origin should be the end nearer x = 0")
        return False
    for value in (*outline["origin"], *outline["insertion"]):
        if not math.isfinite(value):
            print("self-check: non-finite anchor")
            return False
    print("self-check ok")
    return True


def load_catalog(path: Path):
    muscles = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(muscles, list) or not muscles:
        raise SystemExit(f"no muscles in {path}")
    return muscles


def renames(pairs: list[str]) -> dict[str, str]:
    found = {}
    for pair in pairs:
        if "=" not in pair:
            raise SystemExit(f"--rename must look like id=Object Name, got {pair}")
        muscle_id, name = pair.split("=", 1)
        found[muscle_id.strip()] = name.strip().strip('"')
    return found


def mesh_path(mesh_dir: Path, element_id: str) -> Path | None:
    for ext in (".obj", ".stl", ".OBJ", ".STL"):
        candidate = mesh_dir / f"{element_id}{ext}"
        if candidate.exists():
            return candidate
    return None


def import_with_blender(path: Path):
    import bpy

    before = set(bpy.data.objects)
    suffix = path.suffix.lower()
    if suffix == ".obj":
        operator = getattr(bpy.ops.wm, "obj_import", None)
        if operator is not None:
            operator(filepath=str(path))
        else:
            bpy.ops.import_scene.obj(filepath=str(path))
    elif suffix == ".stl":
        operator = getattr(bpy.ops.wm, "stl_import", None)
        if operator is not None:
            operator(filepath=str(path))
        else:
            bpy.ops.import_mesh.stl(filepath=str(path))
    else:
        raise RuntimeError(f"unsupported mesh type {suffix}")
    imported = [
        obj
        for obj in bpy.data.objects
        if obj not in before and obj.type == "MESH"
    ]
    return imported


def world_surface(obj):
    import bpy

    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    matrix = evaluated.matrix_world
    verts = [tuple(matrix @ vertex.co) for vertex in mesh.vertices]
    faces = [list(poly.vertices) for poly in mesh.polygons]
    evaluated.to_mesh_clear()
    return verts, faces


def surface_from_file(path: Path):
    try:
        imported = import_with_blender(path)
        if not imported:
            raise RuntimeError("importer added no mesh")
        verts: list[tuple] = []
        faces: list[list[int]] = []
        for obj in imported:
            part_verts, part_faces = world_surface(obj)
            offset = len(verts)
            verts.extend(part_verts)
            faces.extend([index + offset for index in face] for face in part_faces)
        import bpy

        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
        return verts, faces
    except Exception as exc:
        if path.suffix.lower() != ".obj":
            raise
        print(f"{path.name}: Blender import failed ({exc}); reading OBJ directly.")
        return parse_obj(path)


def find_z_anatomy(muscle, rename: str | None):
    import bpy

    if rename:
        obj = bpy.data.objects.get(rename)
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"no mesh object named {rename}")
        return obj
    hints = NAME_HINTS.get(muscle["id"], (muscle["name"].lower(),))
    best = None
    best_score = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        name = obj.name.lower()
        score = 0
        for hint in hints:
            if hint in name:
                score = max(score, len(hint))
        if score <= 0:
            continue
        if "right" in name and "left" not in name:
            score -= 1000
        if "left" in name or name.endswith(".l"):
            score += 5
        if score > best_score:
            best_score = score
            best = obj
    if best is None or best_score <= 0:
        nearby = sorted(
            obj.name
            for obj in bpy.data.objects
            if obj.type == "MESH" and "pector" in obj.name.lower()
        )
        listed = ", ".join(nearby[:20]) or "(none contain 'pector')"
        raise RuntimeError(
            f"no object matched {muscle['id']}. Nearby meshes: {listed}. "
            'Pass --rename id="Exact object name".'
        )
    return best


# tendon is the shared insertion, placed on the right so the strand fan
# runs origin → tendon the way the pectoralis plate does.
# lateral: away from the midline. distal: toward the feet (Z-up).
# proximal: toward the head, for muscles whose insertion is superior.
GROUPS = {
    "pectoralis_major": {
        "tendon": "lateral",
        "members": (
            "pectoralis_major_clavicular",
            "pectoralis_major_sternal",
            "pectoralis_major_abdominal",
        ),
    },
    "deltoid": {
        "tendon": "distal",
        "members": ("deltoid_clavicular", "deltoid_acromial", "deltoid_spinal"),
    },
    "triceps_brachii": {
        "tendon": "distal",
        "members": ("triceps_long", "triceps_lateral", "triceps_medial"),
    },
    "biceps_brachii": {
        "tendon": "distal",
        "members": ("biceps_long", "biceps_short", "brachialis"),
    },
    "trapezius": {
        "tendon": "lateral",
        "members": ("trapezius_descending", "trapezius_transverse", "trapezius_ascending"),
    },
    "quadriceps": {
        "tendon": "distal",
        "members": ("vastus_lateralis", "rectus_femoris", "vastus_medialis"),
    },
    "hamstrings": {
        "tendon": "distal",
        "members": (
            "biceps_femoris_long",
            "biceps_femoris_short",
            "semitendinosus",
            "semimembranosus",
        ),
    },
    "triceps_surae": {
        "tendon": "distal",
        "members": ("gastrocnemius_medial", "gastrocnemius_lateral", "soleus"),
    },
    "gluteus_maximus": {
        "tendon": "lateral",
        "members": ("gluteus_maximus",),
    },
    "forearm": {
        "tendon": "distal",
        "members": ("brachioradialis", "flexor_carpi_radialis"),
    },
    "erector_spinae": {
        "tendon": "proximal",
        "members": ("iliocostalis_lumborum", "longissimus_thoracis", "spinalis_thoracis"),
    },
}


def path_from_rings(rings, epsilon, project):
    rings = sorted(rings, key=lambda pts: abs(shoelace(pts)), reverse=True)
    if not rings:
        return ""
    outer = abs(shoelace(rings[0]))
    kept = [rings[0]]
    for ring in rings[1:]:
        if abs(shoelace(ring)) >= outer * 0.02:
            kept.append(ring)
    commands = []
    for index, ring in enumerate(kept):
        simplified = simplify_ring(ring, epsilon)
        area = shoelace(simplified)
        if (index == 0 and area < 0) or (index > 0 and area > 0):
            simplified = list(reversed(simplified))
        mapped = [project(x, y) for x, y in simplified]
        head, *rest = mapped
        parts = [f"M {head[0]:.2f} {head[1]:.2f}"]
        parts.extend(f"L {x:.2f} {y:.2f}" for x, y in rest)
        parts.append("Z")
        commands.append(" ".join(parts))
    return " ".join(commands)


def compose_surfaces(parts, tolerance: float, tendon: str = "lateral"):
    """One orthographic frame for every head, so they stack as one muscle."""
    all_verts = [vertex for part in parts for vertex in part["verts"]]
    _lo, _hi, size = extents(all_verts)
    view_axis = min(range(3), key=lambda axis: size[axis])
    # Horizontal is the line of pull, so the tendon sits at the right.
    # Lateral insertions use the left-right axis. Limb insertions use height:
    # BodyParts3D is Z-up, so distal is the low end of that axis.
    side = laterality_axis(all_verts, view_axis)
    vertical = next(axis for axis in range(3) if axis not in (view_axis, side))
    if tendon == "lateral" or side is None:
        ax_x, ax_y = (side if side is not None else 0), vertical
        sign_x = 1
    else:
        # Z-up. The line of pull is height, not whichever axis missed the
        # midline test. A midline muscle (erectors) otherwise stands on end.
        ax_x = 2 if view_axis != 2 else vertical
        ax_y = next(axis for axis in range(3) if axis not in (view_axis, ax_x))
        sign_x = -1 if tendon == "distal" else 1
    planes = [[(sign_x * v[ax_x], v[ax_y]) for v in part["verts"]] for part in parts]
    flat = [point for plane in planes for point in plane]
    min_x = min(point[0] for point in flat)
    max_x = max(point[0] for point in flat)
    min_y = min(point[1] for point in flat)
    max_y = max(point[1] for point in flat)
    span_x = max(max_x - min_x, 1e-9)
    span_y = max(max_y - min_y, 1e-9)
    scale = LONG_SIDE / max(span_x, span_y)
    pixel = max(span_x, span_y) / RASTER
    epsilon = max(tolerance * max(span_x, span_y), pixel * 1.25)

    def project(x, y):
        return ((x - min_x) * scale + PAD, (max_y - y) * scale + PAD)

    union_plane = []
    union_faces = []
    for part, plane in zip(parts, planes):
        offset = len(union_plane)
        union_plane.extend(plane)
        union_faces.extend([index + offset for index in face] for face in part["faces"])
    outline = path_from_rings(
        projected_rings(union_plane, union_faces, min_x, min_y, span_x, span_y),
        epsilon,
        project,
    )
    heads = {}
    for part, plane in zip(parts, planes):
        heads[part["id"]] = path_from_rings(
            projected_rings(plane, part["faces"], min_x, min_y, span_x, span_y),
            epsilon,
            project,
        )
    width = span_x * scale + PAD * 2
    height = span_y * scale + PAD * 2
    return {
        "d": outline,
        "heads": heads,
        "viewWidth": round(width, 2),
        "viewHeight": round(height, 2),
        "viewAxis": AXIS[view_axis],
        "planeAxes": [AXIS[ax_x], AXIS[ax_y]],
    }


def write_group_svg(path: Path, group_id: str, source: str, composed: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    width = composed["viewWidth"]
    height = composed["viewHeight"]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        (
            f"<!-- Derivative outline of {group_id} from {source}. "
            "See ../LICENSES.md. Not a measurement. -->"
        ),
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {width:.2f} {height:.2f}" '
            f'data-muscle-id="{group_id}" data-source="{source}">'
        ),
        f'  <path id="outline" fill="none" stroke="#000" d="{composed["d"]}" />',
    ]
    for head_id, d in composed["heads"].items():
        lines.append(
            f'  <path id="{head_id}" data-role="head" fill="none" stroke="none" d="{d}" />'
        )
    lines.append("</svg>")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def compose_group(args) -> int:
    spec = GROUPS.get(args.compose)
    if not spec:
        print(f"unknown group {args.compose}")
        return 1
    members = spec["members"]
    catalog = {muscle["id"]: muscle for muscle in load_catalog(args.catalog)}
    parts = []
    for muscle_id in members:
        muscle = catalog[muscle_id]
        path = mesh_path(args.mesh_dir, muscle["elementId"])
        if path is None:
            print(f"missing {muscle['elementId']}.obj")
            return 1
        verts, faces = parse_obj(path)
        parts.append({"id": muscle_id, "verts": verts, "faces": faces})
        print(f"{muscle_id}: {path.name}")
    composed = compose_surfaces(parts, args.tolerance, spec.get("tendon", "lateral"))
    if not composed["d"] or any(not d for d in composed["heads"].values()):
        print("compose produced an empty outline")
        return 1
    svg_path = args.out / "svg" / f"{args.compose}.svg"
    write_group_svg(svg_path, args.compose, "bodyparts3d", composed)
    anchors_path = args.out / "anchors.json"
    payload = {}
    if anchors_path.exists():
        payload = json.loads(anchors_path.read_text(encoding="utf-8"))
    groups = payload.setdefault("groups", {})
    groups[args.compose] = {
        "members": list(members),
        "viewBox": [0, 0, composed["viewWidth"], composed["viewHeight"]],
        "viewAxis": composed["viewAxis"],
        "planeAxes": composed["planeAxes"],
        "anchors": "shared-frame",
        "tendon": spec.get("tendon", "lateral"),
    }
    anchors_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {svg_path}")
    return 0


def export_all(args):
    import bpy

    if not self_check():
        return 1
    catalog = load_catalog(args.catalog)
    swapped = set(args.swap)
    named = renames(args.rename)
    if args.source == "bodyparts3d":
        bpy.ops.wm.read_factory_settings(use_empty=True)

    muscles_out = {}
    errors = []
    svg_dir = args.out / "svg"
    for muscle in catalog:
        if muscle.get("elementId") == "atlas":
            continue
        try:
            if args.source == "bodyparts3d":
                path = mesh_path(args.mesh_dir, muscle["elementId"])
                if path is None:
                    raise RuntimeError(
                        f"missing {muscle['elementId']}.obj in {args.mesh_dir}"
                    )
                verts, faces = surface_from_file(path)
                print(f"{muscle['id']}: {path.name}")
            else:
                obj = find_z_anatomy(muscle, named.get(muscle["id"]))
                verts, faces = world_surface(obj)
                print(f"{muscle['id']}: {obj.name}")
            outline = build_outline(
                verts,
                faces,
                args.tolerance,
                muscle["id"] in swapped,
            )
            write_svg(svg_dir / f"{muscle['id']}.svg", muscle, args.source, outline)
            muscles_out[muscle["id"]] = {
                "meshId": muscle["meshId"],
                "elementId": muscle.get("elementId", ""),
                "viewAxis": outline["viewAxis"],
                "planeAxes": outline["planeAxes"],
                "viewBox": [0, 0, outline["viewWidth"], outline["viewHeight"]],
                "origin": outline["origin"],
                "insertion": outline["insertion"],
                "polarity": outline["polarity"],
                "anchors": "geometric-pca",
            }
        except Exception as exc:
            errors.append(f"{muscle['id']}: {exc}")
            print(f"ERROR {muscle['id']}: {exc}")

    if errors:
        print(f"{len(errors)} muscle(s) failed. No anchors.json written.")
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": args.source,
        "anchors": "geometric-pca",
        "note": (
            "Origin and insertion are the ends of the mesh long axis in the "
            "orthographic view. The end nearer the midline is the origin. "
            "They are not dissection landmarks. See LICENSES.md."
        ),
        "muscles": muscles_out,
    }
    (args.out / "anchors.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(muscles_out)} outlines to {args.out}")
    return 0


def main(argv: list[str]) -> int:
    args = cli_args(argv)
    if args.self_check and args.source is None and not args.compose:
        return 0 if self_check() else 1
    if args.compose:
        return compose_group(args)
    return export_all(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
