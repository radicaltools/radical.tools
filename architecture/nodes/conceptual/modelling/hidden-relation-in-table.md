---
id: "076918a4-3472-4ffa-9284-a6dbfb16b172"
type: "scenario"
label: "Hidden relation in table"
given: "the charges card relation hidden in a table view and in a matrix view"
tests: |
  apps/e2e/tests/studio/views.spec.ts › hidden relations › stay out of the Relations tab
  apps/e2e/tests/studio/views.spec.ts › hidden relations › stay out of the matrix
then: "the relation is not listed: the Relations tab counts 3 rows and the matrix marks 3 cells"
when: "the user opens the table's Relations tab or the matrix"
---
