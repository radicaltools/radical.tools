---
id: "88270dea-e60b-477d-b4bf-329d8d95086f"
type: "scenario"
label: "Nested-view edits are saved"
gherkin: "And this is a known bug: endless live-layout updates keep restarting the autosave debounce (marked test.fail)"
given: "the bookstore fixture is open on the Containers view"
metrics: "test(apps/e2e/tests/studio/physics.spec.ts › edits on a view with nested elements are saved without a reload) passed"
then: "the stored document holds seven elements within five seconds"
when: "the user adds a Software System from the palette"
---
