---
id: "f5ee5cb9-4811-4b9e-9fdb-39800e55ff48"
type: "requirement"
label: "Block switching with unsaved edits"
action: "Studio shall stay on the current milestone and reopen the save prompt."
ears_type: "unwanted-behaviour"
rationale: "Switching away would silently lose the edits made on the past state. Evidence: packages/ui/src/store/diagramStore.ts:3215-3219; packages/ui/tests/milestones.test.ts:419-430"
unwanted_condition: "the user selects another milestone while the shown milestone has unsaved edits"
---
