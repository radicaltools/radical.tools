---
id: "93de5df8-47bc-498c-b683-efbfd75699bb"
type: "requirement"
label: "Search results in a table"
action: "Studio shall open All elements as a table showing only the elements found and the containers they are in, with the find bar holding the search, whose close button shows every row again"
ears_type: "event-driven"
rationale: "A search of a large model finds more than a list of results can show; a table can be read, sorted out and edited. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx; packages/ui/src/components/TableView.tsx (only the hits)"
trigger: "the user picks Show all in a table under the elements a search found"
---
