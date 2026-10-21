---
id: "48939d14-adee-4bca-a6ff-9e283150cd60"
type: "scenario"
label: "Search picks a diagram first"
given: "an element shown by a structure view, a smaller table and a smaller matrix; another shown by a wiki, a table and a flow view only; and a wiki and a hierarchy view open"
tests: |
  apps/studio/tests/quickSearchPick.test.ts › the view a pick opens
  apps/studio/tests/quickSearchPick.test.ts › a pick on a wiki or hierarchy view
  apps/e2e/tests/studio/search.spec.ts › a pick on a wiki opens the element's page, and the highlighted result stays in sight
then: "the first opens on the structure view though the others are smaller, the second on the table or wiki before the flow; on a wiki the element's page opens and a hierarchy drills to a level that draws it; the highlighted result stays in sight"
when: "the user picks each in Quick Search, moving the highlight with the arrow keys down a long list of results"
---
