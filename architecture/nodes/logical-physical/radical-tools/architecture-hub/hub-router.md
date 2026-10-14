---
id: "03d6d7e6-d633-43bb-a5bb-b1583813ece6"
type: "component"
label: "Hub router"
technology: "Hash routes"
---

apps/hub/src/hubRoute.ts. Hash routes: empty = landing page, #/browse = the catalogue, #/c/<id>/v/<canvas|wiki|table>/cv/<named view> for a concept, and the catalogue filters cat, tag, status (comma lists) and sort (HubApp pushes a history entry when moving between landing and catalogue, so Back returns). Builds Studio's import link studio.radical.tools?hub=<ids>.
