---
id: "60b9c280-1c6a-49c7-ab8d-373ee6ddaa09"
type: "scenario"
label: "Discussions from table and wiki"
given: "a folder model shown as a table or wiki, in Designer or Viewer, and node discussions shared with the graph"
when: "the user right-clicks a table row, wiki page body or heading, navigation entry or node reference and chooses Discuss, uses Shift+F10 on a table row, or switches views while composing"
then: "the exact target node's shared panel opens and its draft survives view changes, posting is visible from the graph, closing returns focus to the current view, Viewer offers no model edit actions, unsupported storage offers no Discuss action, and text editors retain native menus"
tests: |
  apps/e2e/tests/studio/discussion-views.spec.ts › table rows and wiki page menus share node threads and preserve drafts across views
  apps/e2e/tests/studio/discussion-views.spec.ts › Viewer table and wiki menus allow discussions without offering model editing
  apps/e2e/tests/studio/discussion-views.spec.ts › discussion menus stay unavailable without a folder and keep native menus in text editors
  apps/e2e/tests/studio/discussions.spec.ts › desktop table rows open the same node discussion as the graph
---
