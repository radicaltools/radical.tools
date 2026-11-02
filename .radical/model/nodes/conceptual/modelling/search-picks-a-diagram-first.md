---
id: "48939d14-adee-4bca-a6ff-9e283150cd60"
type: "scenario"
label: "Search picks a diagram first"
given: "an element shown by a structure view, a smaller table and a smaller matrix; another shown by a wiki, a table and a flow view only; a relation whose source alone is shown by a smaller view; and a wiki and a hierarchy view open"
then: "the first opens on the structure view though the others are smaller, the second on the table or wiki before the flow; on a wiki the element's page opens and a hierarchy drills to a level that draws it; the highlighted result stays in sight; the relation opens a view that shows both its ends, drawn and selected"
when: "the user picks each in Quick Search, moving the highlight with the arrow keys down a long list of results, and picks the relation"
---
