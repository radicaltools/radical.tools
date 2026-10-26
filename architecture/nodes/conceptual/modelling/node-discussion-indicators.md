---
id: "416302f9-21b1-4296-97ef-0ee24cf9c004"
type: "scenario"
label: "Node discussion indicators"
given: "a folder model with per-node discussions and a graph whose discussion panel is closed"
tests: |
  packages/common/tests/discussions.test.ts › node discussions › counts threads by stable node ID, including resolved threads and missing targets rather than replies
  apps/studio/tests/discussions.test.ts › discussion session › keeps marker snapshots stable across drafts, replies and unchanged polls, while resolution updates their counts
  apps/studio/tests/discussions.test.ts › discussion session › shares one background poll between the canvas and panel and stops after both leave
  apps/e2e/tests/studio/web-discussions.spec.ts › node discussion corner icons open the right panel, persist after resolution and refresh while closed
  apps/e2e/tests/studio/web-discussions.spec.ts › an export of the view leaves out the discussion icons
then: "nodes with threads show a top-right speech-bubble marker with thread/open counts, including all-resolved conversations; markers refresh while closed and open the correct node panel, stay outside model exports, and unchanged counts or draft edits do not repaint the canvas; the panel and canvas share one poll that stops when both leave"
when: "a thread is posted or resolved, discussion data changes externally, the folder is reopened, or the user clicks or keyboard-activates a node's discussion marker; or the view is exported as an image"
---
