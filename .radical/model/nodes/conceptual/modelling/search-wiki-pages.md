---
id: "765f5535-f2aa-4118-a98f-7831e6feb1ef"
type: "requirement"
label: "Search wiki pages"
action: "mark the pages whose name or text matches, reading Markdown fields as the page shows them (not a link's address or a mark such as **), with a snippet of the matching text, open the first match on Enter, and say when nothing matches, also in a wiki whose chain loops"
ears_type: "event-driven"
rationale: "A page is found by what it says, not only by its name. Evidence: apps/e2e/tests/studio/wiki.spec.ts"
trigger: "the user types in the Search pages box of a wiki view"
---
