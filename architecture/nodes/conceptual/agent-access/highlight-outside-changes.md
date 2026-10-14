---
id: "e22a6ccf-d63d-45a8-b204-6e9811741b18"
type: "requirement"
label: "Highlight outside changes"
action: "Studio shall mark the added and changed elements and relations with the milestone diff colours and draw the removed ones as ghosts for about five seconds after the last such change, adding up changes that arrive in a burst, ignoring changes of layout alone, leaving the overlay to a shown milestone, and saving nothing."
ears_type: "event-driven"
rationale: "Agent edits arrive while the user looks at the canvas; without a mark the user cannot see what the agent did. A short highlight, not a review step (the user chose this over milestones or accept/reject). Evidence: apps/studio/src/renderer/src/persistence/changeFlash.ts, apps/studio/src/renderer/src/persistence/autosave.ts (onOutsideEditLoaded)."
trigger: "Studio reloads the active folder model because its files changed outside the app (an agent over MCP, an editor or git) and elements or relations changed"
---
