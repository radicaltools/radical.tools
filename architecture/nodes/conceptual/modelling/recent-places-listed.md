---
id: "b5334c02-d6c9-497c-9bd3-9fd5c0ea915c"
type: "scenario"
label: "Recent places listed"
given: "the user has opened two views and selected an element"
metrics: "test(apps/e2e/tests/studio/search.spec.ts › the empty bar lists the places visited, and a pick goes back there) passed"
then: "the places are listed newest first without the one shown, and a pick goes back to it"
when: "they focus Quick Search with nothing typed"
---
