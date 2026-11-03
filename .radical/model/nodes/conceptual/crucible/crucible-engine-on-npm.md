---
id: "0023a9e6-d42e-44d1-8390-295b54fee3d4"
type: "need"
label: "Crucible engine on npm"
kind: "brief"
source: "Product owner, 2026-11-03"
---

radical fuzz is in the published CLI, but the engine a fuzz file is written with is not on npm. The demo repository had to write its fuzz file on fast-check by hand, and --survey, --replay and radical harden of a finding do not work there. Publish the engine.
