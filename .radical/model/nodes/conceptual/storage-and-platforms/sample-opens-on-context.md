---
id: "479d46e2-f121-40dd-acd1-07f0e9cef7c1"
type: "scenario"
label: "Sample opens on context"
given: "the Welcome screen"
metrics: |
  test(apps/e2e/tests/studio/boot.spec.ts › first visit › the sample opens on its System Context view) passed
  test(apps/e2e/tests/studio/boot.spec.ts › first visit › Try the sample model opens it on its System Context view) passed
then: "the canvas shows \"Structure: System Context\" with 8 elements and 7 relations including Core Banking Platform"
when: "the user opens the sample"
---
