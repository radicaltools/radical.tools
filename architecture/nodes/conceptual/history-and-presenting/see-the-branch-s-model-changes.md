---
id: "030aeb66-9e5c-4bfa-8cb5-5fef7f99077d"
type: "need"
label: "See the branch's model changes"
kind: "stakeholder-note"
source: "Product owner, 2026-10-16"
---

"How would you show these changes in Studio? Remember that Studio reads only the model; it has no access to a git API."
After the proposal (the CLI and the MCP server save the model at the git base to .radical/base.json, Studio compares the open model with it as it is edited) and a mockup (a toggle with the changes marked on the canvas, a count per view, the changed words on the properties card, a "This change" section in the Inspector's Implementation tab with what the tests say, the states without a base or with an old one): "Is base.json a copy of the model?" (the elements and relations only, with their positions for the ghosts), then "OK, build it."
After it was built: "I also want a list of the changes", as a list that opens from the chip over the view.
Translated from Polish.
