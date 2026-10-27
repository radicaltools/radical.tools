---
id: "dd7fd20e-d250-47a9-954c-92f5f0d1167f"
type: "scenario"
label: "Search results as a table"
given: "a search that finds more elements than the list shows"
tests: "apps/e2e/tests/studio/search.spec.ts › Show all in a table lists only the elements found"
then: "All elements opens as a table of only the elements found and their containers, with the find bar holding the search; its close button shows every row"
when: "the user picks Show all in a table"
---
