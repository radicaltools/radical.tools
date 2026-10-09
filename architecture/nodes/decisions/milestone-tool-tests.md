---
id: "e7e86af7-71d7-4c37-9e75-fb8cc0bd383d"
type: "fitness-fn"
label: "Milestone tool tests"
category: "structural"
threshold: "Both suites pass in CI"
---

packages/common/tests/aiDocumentTools.test.ts › milestone tools (save phases, compare by label without layout changes, rename, delete, the current model unchanged; slides show a milestone with focus checked against it; a slide moved to another milestone loses its captured framing; deleting a milestone unlinks its slides; create and compare refuse while Studio has a milestone loaded; Forge's exclusion drops the group) and › compareModels (one definition of a change, shared with Studio's diff highlight: any field but the layout), and apps/mcp/src/folderModel.test.ts › milestones (create_milestone writes snapshots.json, the summary lists milestones, compare_milestones writes nothing).
