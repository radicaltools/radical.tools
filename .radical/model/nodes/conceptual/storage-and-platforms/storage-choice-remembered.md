---
id: "e02c1714-a9d7-43de-9afc-13e44525b9bf"
type: "requirement"
label: "Storage choice remembered"
action: "preselect the same storage the next time the user chooses New model"
ears_type: "event-driven"
rationale: "Users who keep their models as files or folders should not have to pick that again for every model. Evidence: apps/e2e/tests/studio/files.spec.ts, apps/e2e/tests/studio/folders.spec.ts"
trigger: "the user creates a new model kept in a file or a folder"
---
