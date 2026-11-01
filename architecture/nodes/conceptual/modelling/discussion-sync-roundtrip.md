---
id: "fb938ddb-8a50-4d70-884a-da3786b5cb79"
type: "scenario"
label: "Discussion sync roundtrip"
given: "a managed wiki tree, matching current view and node-page ownership markers, local discussions and Confluence footer comments"
metrics: "test(apps/cli/src/discussionSync.test.ts) passed"
then: "roots and nested replies keep their page and parent mapping, supported text and provenance survive, emails are not exported, excluded or unsupported conversations stay held, and a repeat run makes no remote writes"
when: "the user previews and confirms node-scoped discussion sync, then runs it again"
---
