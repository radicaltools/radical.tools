---
id: "f173dbd5-96f5-432a-84c6-999bdcdc3c2f"
type: "scenario"
label: "Settings kept until Save"
given: "a folder model open in the Inspector's Settings"
metrics: "test(apps/e2e/tests/studio/inspector.spec.ts › Settings edits wait for Save on another tab and after Back, and the tab says so) passed"
then: "the change is still there each time and the Settings tab says it is unsaved; check.json holds it only after Save"
when: "the user changes a severity, opens another tab and comes back, goes Back and forward, then saves"
---
