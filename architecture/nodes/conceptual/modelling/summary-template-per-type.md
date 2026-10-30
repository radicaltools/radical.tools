---
id: "8acf4b1d-7429-4b48-b6c6-df2fb995dc11"
type: "scenario"
label: "Summary template per type"
given: "the bookstore Element Table, Payment Provider's summary reading Card payments"
metrics: |
  test(apps/e2e/tests/studio/metamodel-editor.spec.ts › a type's summary template, with how it reads, sets the summary the table shows) passed
  test(packages/common/tests/nodeSummary.test.ts › element summary: the type's template › a type takes its own template, else the built-in one for its id, else the description) passed
  test(packages/common/tests/nodeSummary.test.ts › element summary: the type's template › leaves out a part in [ ] whose token is empty, and tidies what is left) passed
  test(packages/common/tests/nodeSummary.test.ts › element summary: the type's template › names the elements a ref points at, and escapes brackets) passed
  test(packages/common/tests/nodeSummary.test.ts › element summary: the type's template › offers the tokens a type has) passed
  test(packages/common/tests/nodeSummary.test.ts › element summary: what matters first, never empty) passed
then: "the field shows the built-in template as its placeholder and the type's tokens, a preview on one of its elements, and the table then reads Payment Provider — Card payments; a part in [ ] goes when its token is empty, a ref names the elements it points at, an empty result falls back to the description; the built-in templates put what matters first (a scenario's outcome before its when, a domain's kind, a state machine's entity) and a state, pseudostate or event without a description says where it leads; {a|b} takes the first alternative with a value and {in:type} names linked elements"
when: "the user sets the Software System type's Summary in tables to {label} — {description} in the metamodel editor"
---
