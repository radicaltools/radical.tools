---
id: "75f3e81c-a291-4a8f-86ef-4f2f6ec2b2a8"
type: "scenario"
label: "Moves never make it worse"
given: "every bench model and the author's view"
tests: |
  packages/layout/tests/tidy/tidy.test.ts › Tidy › never makes a layout worse
  packages/layout/tests/tidy/tidy.test.ts › Tidy › stops when nothing is left to do
then: "the reader's cost is never higher after than before; no step has a negative gain (a pair taken together carries its gain on the second move, the first marked as making way); 300 elements piled up take a few seconds"
when: "Tidy runs, and runs again on its result"
---
