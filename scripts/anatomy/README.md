# Muscle outline export

Offline step. It is not part of the app build. Blender writes a simplified
orthographic silhouette and two fiber anchors for every muscle in
`src/features/anatomy/muscles.json`.

Outputs, both share-alike derivatives:

- `public/anatomy/svg/<muscleId>.svg`
- `public/anatomy/anchors.json`

The app code stays in `src/` and `scripts/`. Credits and the license that
follows each file live in `public/anatomy/LICENSES.md`. Read that before
shipping anything this script writes.

The silhouette is the shadow of every triangle along the mesh's thinnest
axis, simplified to one path. For the three pectoralis heads that axis is
the front view. Origin and insertion are the two ends of the long axis in
that view. The end closer to the midline is the origin. They are geometric
stand-ins, not dissection landmarks. If a head comes out reversed, rerun
with `--swap <muscleId>`.

## Which meshes

The catalog is the list. The chest seed is:

| Muscle id | BodyParts3D part | Element file |
|---|---|---|
| `pectoralis_major_clavicular` | FMA34687, clavicular head | `FJ1447M.obj` |
| `pectoralis_major_sternal` | FMA34696, sternocostal part (sternal and costal fibers in one mesh) | `FJ1464M.obj` |
| `pectoralis_major_abdominal` | FMA34699, abdominal head | `FJ1446M.obj` |

`FJ…M` is the left-side element. The script exports that side.

## Get BodyParts3D

Download the BodyParts3D 4.0 element OBJ archive from the Database Center
for Life Science:

https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html

Unpack it so each element is its own `.obj` (or `.stl`). A local unpack in
this workspace is `.tmp-assets/bp3d/obj/`. That folder is not shipped.

The file header on those OBJs states CC BY-SA 2.1 Japan. The current
database license page is separate. Both are recorded in `LICENSES.md`.

## Get Z-Anatomy

Use the Blender template from the project repository, which is CC BY-SA 4.0:

https://github.com/Z-Anatomy/Models-of-human-anatomy

Those meshes are adapted from BodyParts3D, so an export from this file
still credits BodyParts3D as well.

Do not use the 2021 Zenodo upload (`10.5281/zenodo.4953712`) for this
step. That record is labeled CC BY 4.0 and is a different package from the
share-alike GitHub template.

Z-Anatomy names objects in English. The script looks for the left
clavicular, sternocostal, and abdominal parts of pectoralis major. If a
name does not match, the run prints nearby object names and stops. Pass
the printed name back:

```text
--rename pectoralis_major_sternal="Exact object name"
```

## Command

Install Blender 3.4 or newer (4.x is what the importer calls are written
for). From the repo root.

BodyParts3D, PowerShell:

```powershell
blender --background --python scripts/anatomy/export_outlines.py -- --source bodyparts3d --mesh-dir ".tmp-assets/bp3d/obj" --catalog "src/features/anatomy/muscles.json" --out "public/anatomy"
```

The pectoralis is one fan, so its three heads are projected in a single frame. That step reads the OBJs directly and does not need Blender:

```powershell
python scripts/anatomy/export_outlines.py --compose pectoralis_major --mesh-dir ".tmp-assets/bp3d/obj" --catalog "src/features/anatomy/muscles.json" --out "public/anatomy"
```

If `blender` is not on `PATH`, call the executable instead, for example
`& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"` with the
same arguments. Use the version that is actually installed.

Z-Anatomy, PowerShell:

```powershell
blender --background "C:\path\to\Z-Anatomy.blend" --python scripts/anatomy/export_outlines.py -- --source z-anatomy --catalog "src/features/anatomy/muscles.json" --out "public/anatomy"
```

The `.blend` path has to be a real file. Blender loads it before the script
runs. Do not pass `--mesh-dir` for this source.

Optional flags, placed after `--`:

- `--swap pectoralis_major_sternal` exchanges that muscle's anchors. Repeat for each id.
- `--tolerance 0.004` is the default simplification error, as a fraction of the longer side of the outline.
- `--self-check` runs the box fixture and does not write files. Without `--source`, this also runs under plain Python: `python scripts/anatomy/export_outlines.py --self-check`

A failed muscle prints `ERROR` and the script exits non-zero without
writing `anchors.json`. Fix the path or the object name and run it again.

## What lands in the SVG

One closed path, `id="outline"`, in a viewBox about 1000 units on the long
side. `anchors.json` stores `origin` and `insertion` in that same viewBox,
plus `viewAxis`, `polarity` (`midline`, `unsigned`, or `swapped`), and the
source name. `unsigned` means the mesh crossed the midline on every axis,
so the script could not tell origin from insertion.
