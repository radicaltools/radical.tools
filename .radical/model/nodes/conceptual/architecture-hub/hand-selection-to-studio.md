---
id: "c8ae3d34-1f27-46ad-86fe-cc5a4a37ff35"
type: "requirement"
label: "Hand selection to Studio"
action: "The Hub shall open Studio in a new tab with a link of the selected concepts, and Studio shall show the Import from Hub dialog with them over the model open; with no model open, Studio shall name the packs that wait on the Welcome screen, open no dialog hidden under it, and open the import once a model is opened or created, the packs waiting across a reload of the Welcome screen until their import has opened; after that a reload shall ask nothing."
ears_type: "event-driven"
rationale: "One click from browsing to the user's own model. With no model open the dialog opened hidden under the Welcome screen and the link was lost (F-0124, round 201–210); the maintainer decided that it waits on the Welcome screen. Evidence: apps/hub/src/HubApp.tsx:407-414,661-667,724-726; apps/hub/src/hubRoute.ts:84-88; apps/studio/src/renderer/src/App.tsx (takeHubLink, OPEN_HUB_EVENT); manual#hub. The link left the address at once, so a reload of the Welcome screen forgot the pack it said waits; the maintainer decided that a pack waits across a reload until its import opens (F-0170, round 211–220; App.tsx doneWithHubLink)."
trigger: "the user selects concepts in the Hub and clicks Add to Studio"
---
