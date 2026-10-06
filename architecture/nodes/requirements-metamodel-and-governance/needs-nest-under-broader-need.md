---
id: "f6072b69-e77d-41bd-938e-c89a7b60083b"
type: "scenario"
label: "Needs nest under broader need"
gherkin: |
  And the wiki page lists the sub-need under "Derives from this"
  # Covered by: apps/e2e/tests/studio/need.spec.ts › needs nest under a broader need: a tree in the table, and Add child on its wiki page
given: "a need \"Shop staff interviews\" derives from \"Click & collect discovery\", and a requirement derives from the interviews"
then: "the sub-need is indented under its parent, the requirement stays a root of its own tab, and the new need is created already linked to the discovery by Derives from"
when: "the user opens the Need tab of the table and the discovery's wiki page, and adds a Need with Add child"
---
