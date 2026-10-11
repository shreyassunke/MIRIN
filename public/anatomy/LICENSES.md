# Anatomy asset licenses

Files in this directory are derivatives of anatomical meshes. App code under
`src/` and `scripts/` is not a derivative of those meshes and does not live
here.

`svg/<muscleId>.svg` carries `data-source="bodyparts3d"` or
`data-source="z-anatomy"`. `anchors.json` repeats that source. Credit every
source named on the file you ship. An export from Z-Anatomy credits both
projects, because those meshes are adapted from BodyParts3D.

What was modified: each muscle mesh was reduced to an orthographic outline
path and two geometric anchor points (the ends of the mesh's long axis).
The original OBJ, STL, and Blender files are not included.

These outlines are not measurements. Fiber-type ratios and exercise
involvement are separate data in `src/features/anatomy/` and are not covered
by this file.

## Z-Anatomy

- Work: Z-Anatomy, the libre 3D atlas of anatomy
- Authors: Gauthier Kervyn and Marcin Zielinski
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- Source: https://github.com/Z-Anatomy/Models-of-human-anatomy
- Deed: https://creativecommons.org/licenses/by-sa/4.0/

Adapted material stays under CC BY-SA 4.0, with attribution to Z-Anatomy and
a link to that deed.

## BodyParts3D

- Work: BodyParts3D / Anatomography, version 4.0
- Licensor: Database Center for Life Science, Research Organization of Information and Systems
- Citation: Mitsuhashi N, et al. BodyParts3D. Nucleic Acids Research. 2009. doi:10.1093/nar/gkn613
- Download: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Current license page (updated 2025-02-27): https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

Two statements apply, and they are not the same document:

1. The element OBJ files used by the exporter print this notice in the file
   header: the database is licensed under Creative Commons
   Attribution-ShareAlike 2.1 Japan, and redistribution must attribute it as
   "BodyParts3D, (c) The Database Center for Life Science licensed under CC
   Attribution-Share Alike 2.1 Japan".
   Deed: https://creativecommons.org/licenses/by-sa/2.1/jp/
2. The current license page linked above is the DBCLS database license. It
   allows access, redistribution, and derivative works provided the database
   is attributed. It is not a Creative Commons deed. Uses outside that grant
   need a separate license from the Database Center for Life Science.

Derivatives made from those OBJ files keep the share-alike obligation in the
file header and the attribution the current page requires. This directory
does not relicense them as CC BY-SA 4.0.

## Flutter body atlas

`svg/latissimus_dorsi.svg` and `svg/rectus_abdominis.svg` are sampled from
the outlines in `src/lib/anatomy.generated.ts`. BodyParts3D 4.0 has no named
element for either muscle.

- Work: flutter-body-atlas anterior and posterior plates
- Author: Ryan Graves
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- Source: https://www.figma.com/community/file/1320468164820924031
- Deed: https://creativecommons.org/licenses/by/4.0/
