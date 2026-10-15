---
id: "f6072b69-e77d-41bd-938e-c89a7b60083b"
type: "scenario"
label: "Needs nest under broader need"
gherkin: "And the wiki page lists the sub-need under \"Derives from this\""
given: "a need \"Shop staff interviews\" derives from \"Click & collect discovery\", and a requirement derives from the interviews"
tests: "apps/e2e/tests/studio/need.spec.ts › needs nest under a broader need: a tree in the table's chain, and Add child on its wiki page"
then: "in the table, whose chain starts at needs deriving from none and follows Refined into twice, the sub-need hangs under its parent and the requirement under the sub-need, and the new need is created already linked to the discovery by Derives from"
when: "the user opens the table and the discovery's wiki page, and adds a Need with Add child"
---
