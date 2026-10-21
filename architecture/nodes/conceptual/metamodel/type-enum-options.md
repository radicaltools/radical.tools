---
id: "9fc92dec-1a77-40e6-85ee-2712db9c4cb6"
type: "scenario"
label: "Type enum options"
given: "a new enum property keyed tier on the Container type"
tests: |
  apps/e2e/tests/studio/metamodel-editor.spec.ts › custom properties of a type › enum options can be typed, commas and spaces included
  apps/e2e/tests/studio/metamodel-editor.spec.ts › typing an enum's first options asks nothing until the field is left
  apps/e2e/tests/studio/metamodel-editor.spec.ts › enum options typed and the editor closed with Esc are kept as the field showed them
then: "the field keeps the text as typed and the type saves the three options gold, in progress and bronze; nothing is asked until the field is left; the options typed before Esc are kept as the field showed them"
when: "the user types \"gold, in progress, bronze\" into its options and closes the editor; types a new enum's first options letter by letter and leaves the field; types options and closes the editor with Esc"
---
