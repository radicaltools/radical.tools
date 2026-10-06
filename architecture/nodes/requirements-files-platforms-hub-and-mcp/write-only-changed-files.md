---
id: "364b6aa3-6057-4c10-973d-b2da937c0ab8"
type: "requirement"
label: "Write only changed files"
action: "The folder session shall write only the files whose content changed and delete only stale files that the format owns."
ears_type: "event-driven"
rationale: "Small diffs and no churn on untouched files. Evidence: packages/common/src/formats/mdFolderSync.ts:66-95; packages/common/tests/mdFolderSync.test.ts ('writes only files whose content changed'); manual#formats"
trigger: "Studio or the MCP server saves a folder model"
---
