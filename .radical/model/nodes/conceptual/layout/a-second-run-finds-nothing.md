---
id: "23da7eb7-4987-4e8c-901f-82b38eb69d8a"
type: "scenario"
label: "A second run finds nothing"
given: "every blueprint, tidied once; a state machine view of this repository's model; and views with a row, a column or a grid set"
metrics: |
  test(packages/layout/tests/tidy/tidy.test.ts › Tidy › leaves nothing for a second run: every blueprint tidied twice) passed
  test(packages/layout/tests/tidy/tidy.test.ts › Tidy › never goes round in circles) passed
  test(packages/layout/tests/tidy/tidy.test.ts › Tidy › leaves nothing for a second run on a state machine view of the repository's own model (F-0107)) passed
  test(packages/layout/tests/tidy/tidy.test.ts › Tidy › leaves nothing for a second or third run with a row, a column or a grid set on the view (F-0108)) passed
then: "the second run makes no move, and no run comes back to a layout it has left; on the state machine view and on the views with a row, a column or a grid, the second run (and the third) makes no move either"
when: "Smart Layout tidies each again"
---
