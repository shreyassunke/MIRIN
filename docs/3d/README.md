# 3D weight instruments

Provenance for the procedural barbell and dumbbell in the weight picker.

- Gym references: [docs/3d/reference/](reference/) — urethane circular dumbbell, bumper-plate Olympic bar
- Line-art (fallback SVG): [docs/reference/](../reference/)
- Authored specs: `barbell-sculpt-spec.json`, `dumbbell-sculpt-spec.json`

Factories live in `src/components/weight/three/`. They stay parametric with the picker (head size, plate stack, denomination stamps). Brand marks from the reference photos are not copied; the face shows the selected weight.

The forge checkout is local-only (`.img2threejs-forge`, gitignored).
