---
id: "27e1d49e-e220-473b-a672-50607e58c2d5"
type: "requirement"
label: "Favour a √2 aspect ratio"
action: "Smart Layout shall penalise layouts whose bounding box departs from a √2 aspect ratio, with a penalty that grows with the cube of the deviation."
ears_type: "ubiquitous"
rationale: "Tall single-column or very wide layouts are hard to read on a screen or a slide. Evidence: packages/layout/src/scoreWeights.ts:35-56; packages/layout/src/smartLayout.ts:458-470, packages/layout/src/smartLayout.ts:588-590; README (aspect-ratio penalty)"
---
