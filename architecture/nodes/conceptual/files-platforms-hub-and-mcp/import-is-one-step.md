---
id: "b3b260e5-9cd9-4040-8f8d-4764efd6d3b0"
type: "requirement"
label: "Import is one step"
action: "record the whole import as one undo step"
ears_type: "event-driven"
rationale: "One Undo should take back what one import brought in, not only the main concept. Evidence: apps/e2e/tests/studio/hub-import.spec.ts"
trigger: "the user imports a Hub concept together with its related concepts"
---
