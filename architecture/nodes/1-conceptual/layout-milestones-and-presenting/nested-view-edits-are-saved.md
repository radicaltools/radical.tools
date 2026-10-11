---
id: "88270dea-e60b-477d-b4bf-329d8d95086f"
type: "scenario"
label: "Nested-view edits are saved"
gherkin: |
  And this is a known bug: endless live-layout updates keep restarting the autosave debounce (marked test.fail)
  # Covered by: apps/e2e/tests/studio/known-issues.spec.ts › edits on a view with nested elements are saved without a reload
given: "the bookstore fixture is open on the Containers view"
then: "the stored document holds seven elements within five seconds"
when: "the user adds a Software System from the palette"
---
