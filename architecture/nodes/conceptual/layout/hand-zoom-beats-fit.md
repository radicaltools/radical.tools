---
id: "6b069339-da05-451c-a766-6701e8dc385e"
type: "scenario"
label: "Hand zoom beats fit"
given: "the bookstore Containers view zoomed in with the wheel, with Smart fit on"
metrics: "test(apps/e2e/tests/studio/physics.spec.ts › zooming with the wheel wins over a fit still animating) passed"
then: "the camera stays at the hand-picked zoom and Smart fit stays switched on"
when: "the user clicks Fit All and zooms in with the wheel while the fit is still animating"
---
