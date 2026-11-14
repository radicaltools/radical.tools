---
id: "b77fe22f-9dc0-4e07-b355-65cb4647a412"
type: "need"
label: "Verification path from the Inspector"
kind: "stakeholder-note"
source: "Product owner, 2026-11-14"
---

"As for the Inspector: I want to be able to navigate from the Inspector along the whole validation path, that is ADR → fitness function → metric/test and result, or need → requirement → scenario → test and result."
Settled after the proposal: the element panel stays as it is (Checks, Checked by); beside it a panel of its own shows the whole path graphically, rather than a temporary view on the canvas, because tests and metric conditions are no elements of the model; a test's file opens in VS Code through a vscode:// link. Agents get the same path over MCP and the CLI.
Translated from Polish.
