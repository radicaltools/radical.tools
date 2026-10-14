---
id: "5b0ce114-4db1-463c-9d0d-f75a1d3b552f"
type: "requirement"
label: "Sort the catalogue"
action: "The Hub shall order the concepts by that key, Connections by how many concepts each one links to or is linked from, show them as one ranked list instead of category groups when sorted by Connections, and keep a sort other than Name in the page link."
ears_type: "event-driven"
rationale: "Ties fall back to the name. Evidence: apps/hub/src/HubApp.tsx (groups, SORT_LABELS), packages/ui/src/store/hubStore.ts (filteredConcepts, buildConnectionCounts), apps/hub/src/hubRoute.ts"
trigger: "the user picks Name, Category or Connections in the Hub's Sort list"
---
