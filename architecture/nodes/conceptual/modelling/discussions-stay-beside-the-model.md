---
id: "4a53adbe-4e5a-4ec8-ade9-1409fd7f53f4"
type: "scenario"
label: "Discussions stay beside the model"
given: "a desktop model folder and participating discussion writers"
tests: "packages/node-files/tests/discussions.test.ts"
then: "only the first post creates discussions.json, nested comments reopen intact, writers retain each other's replies, stale actions are refused, model saves and polling ignore discussions, unreadable content is not overwritten, a live lock is never taken over and failures leave no temporary files"
when: "the first comment, concurrent replies and resolution actions are written, the folder is reopened or saved and pruned, or its discussion file becomes unreadable, conflicted or missing"
---
