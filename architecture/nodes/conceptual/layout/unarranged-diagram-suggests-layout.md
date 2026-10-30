---
id: "063ceac9-481f-44a1-b98b-697f08915ce2"
type: "scenario"
label: "Unarranged diagram suggests layout"
given: "a diagram of 225 linked elements squeezed so that they overlap"
metrics: "test(apps/e2e/tests/studio/physics.spec.ts › a large diagram keeps its positions on open and suggests Smart Layout when it is not laid out) passed"
then: "Studio says the diagram is not laid out yet and suggests Smart Layout, and no element moves"
when: "the user opens it"
---
