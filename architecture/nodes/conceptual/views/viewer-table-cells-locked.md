---
id: "4732f1e6-2452-4300-a849-143d4c70ede5"
type: "scenario"
label: "Viewer table cells locked"
given: "a table view with a Software System tab whose External column is yes/no, open in Viewer"
tests: "apps/e2e/tests/studio/views.spec.ts › custom metamodel › boolean table cells are read-only in Viewer"
then: "it stays checked"
when: "the user clicks Payment Provider's External cell"
---
