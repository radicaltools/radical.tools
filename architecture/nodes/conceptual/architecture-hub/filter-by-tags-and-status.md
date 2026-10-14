---
id: "8f212f42-5336-40c8-aa2a-fda0ee0573f6"
type: "requirement"
label: "Filter by tags and status"
action: "The Hub shall list only the concepts that carry any of the chosen tags and any of the chosen statuses, combined with the category and the search, show each chip's concept count, and keep the chosen tags and statuses in the page link."
ears_type: "event-driven"
rationale: "Values within one facet OR together, facets AND with each other and with the category and search; the Tags facet shows the 16 most used tags with a +N more toggle, the Status facet appears only when some concept has a status. Evidence: apps/hub/src/HubApp.tsx (FacetGroup), packages/ui/src/store/hubStore.ts (filteredConcepts), apps/hub/src/hubRoute.ts"
trigger: "the user toggles tag or status chips in the Hub catalogue"
---
