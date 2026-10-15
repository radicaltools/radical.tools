---
id: "8ff79bac-1bea-4189-a23b-65005d9c8a43"
type: "scenario"
label: "Element table tree"
gherkin: ""
given: "the bookstore Element Table view with no element list (whole model) and no steps"
tests: |
  apps/e2e/tests/studio/views.spec.ts › bookstore views › Element Table (table)
  apps/e2e/tests/studio/views.spec.ts › bookstore views › a name is renamed in place in the table
  packages/common/tests/nodeSummary.test.ts › element summary › says what each type means by it
  packages/common/tests/nodeSummary.test.ts › element summary › falls back to the description's first sentence, in one line
then: "6 rows in the containment tree, Bookstore's three containers one level in, no tabs, Payment Provider's summary reading 'Card payments'; the new name is saved; each summary says in one line what its type means by it, a need the first sentence of its brief"
when: "the user opens it and renames Payment Provider in its name cell; and summaries are taken of a requirement, a scenario, an ADR, a fitness function, a mockup, a container and a need"
---
