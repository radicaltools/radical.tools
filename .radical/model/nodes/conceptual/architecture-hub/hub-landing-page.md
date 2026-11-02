---
id: "dc11fe2f-4be4-4548-a60c-0f429f1db53d"
type: "requirement"
label: "Hub landing page"
action: "The Hub shall show a landing page with the number of concern packs, a search box and one tile per concern group with its pack count and what the group decides, open the catalogue with the search or the group the user picks, and return to the landing page on the browser's Back."
ears_type: "event-driven"
rationale: "The landing page is the Hub's front door; a scenario (Hub landing shows categories) exists without a requirement. An empty hash is the landing page, #/browse the bare catalogue; leaving the landing pushes a history entry. Evidence: apps/hub/src/HubLanding.tsx, apps/hub/src/HubApp.tsx, apps/hub/src/hubRoute.ts, apps/e2e/tests/hub/hub.spec.ts"
trigger: "the user opens the Hub with no concept or filter in the link"
---
