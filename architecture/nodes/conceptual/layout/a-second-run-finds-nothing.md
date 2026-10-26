---
id: "23da7eb7-4987-4e8c-901f-82b38eb69d8a"
type: "scenario"
label: "A second run finds nothing"
given: "every blueprint, tidied once"
tests: |
  packages/layout/tests/tidy/tidy.test.ts › Tidy › leaves nothing for a second run: every blueprint tidied twice
  packages/layout/tests/tidy/tidy.test.ts › Tidy › never goes round in circles
then: "the second run makes no move, and no run comes back to a layout it has left"
when: "Smart Layout tidies each again"
---
