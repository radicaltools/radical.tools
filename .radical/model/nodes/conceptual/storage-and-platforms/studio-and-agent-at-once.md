---
id: "738eb5b7-6293-440e-bb82-1866af593142"
type: "need"
label: "Studio and agent at once"
kind: "stakeholder-note"
source: "Product owner, 2026-10-19"
---

"When the MCP server and Radical Studio use the folder at the same time there is a concurrency problem; how best to solve it, with known algorithms or libraries?" After weighing three-way merge, CRDTs (Automerge, Yjs), element locks, an operation log and presence: merge at the level of files and entries (A), and Studio holding its saves while an agent writes (B); CRDTs later, if live multi-user editing is wanted.
Translated from Polish.
