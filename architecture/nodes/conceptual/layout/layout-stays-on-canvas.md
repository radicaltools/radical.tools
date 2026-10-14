---
id: "1d73e896-c2c5-4aa4-99cf-81ae89f4e726"
type: "scenario"
label: "Layout stays on canvas"
given: "Smart Layout running on the sample's All elements canvas"
tests: "apps/e2e/tests/studio/physics.spec.ts › a layout started on one canvas does not land on another"
then: "Studio says the layout was not applied, and Core Banking keeps the positions it showed and had saved"
when: "the user opens the Core Banking view before the layout is done"
---
