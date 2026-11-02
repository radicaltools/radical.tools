---
id: "1eeeb6b0-e565-4d36-9bd5-fec8c18437e3"
type: "need"
label: "Peek at test code"
kind: "stakeholder-note"
source: "User discussion, 2026-10-17"
---

I want a Code view where I can quickly inspect the test code associated with an existing scenario. Test code should be marked with the scenario's GUID so I can move from the model to the relevant source without searching manually.

**Proposed approach:** Index lightweight scenario-GUID markers in test source files and show the matching test blocks in a read-only Code view, with their file paths and line numbers and an action to open them in the editor. Treat GUID markers as a proposed extension to the current file-and-test-title bindings.
