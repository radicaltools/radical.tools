---
id: "5531edb6-f22c-4419-9a01-a48d71dd1b1f"
type: "scenario"
label: "An ADR dropped without its wizard"
given: "a canvas on the Radical metamodel, with wizards on"
metrics: "test(apps/e2e/tests/studio/wizard.spec.ts › dropping an ADR with the special key held adds it without its wizard) passed"
then: "the first is added at once with no wizard; the second opens the ADR wizard"
when: "the user drops an ADR from the palette with the special key held, then one without it"
---
