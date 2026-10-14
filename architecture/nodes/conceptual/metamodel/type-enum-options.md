---
id: "9fc92dec-1a77-40e6-85ee-2712db9c4cb6"
type: "scenario"
label: "Type enum options"
given: "a new enum property keyed tier on the Container type"
tests: "apps/e2e/tests/studio/metamodel-editor.spec.ts › custom properties of a type › enum options can be typed, commas and spaces included"
then: "the field keeps the text as typed and the type saves the three options gold, in progress and bronze"
when: "the user types \"gold, in progress, bronze\" into its options and closes the editor"
---
