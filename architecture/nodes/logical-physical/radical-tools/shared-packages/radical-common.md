---
id: "ff9c535a-4924-4b30-b055-0a329c542dea"
type: "component"
label: "@radical/common"
technology: "TypeScript"
---

The model shared by every app: C4 types, the two built-in metamodels (Radical and C4) with their validator, statechart and aggregate rules, EARS sentences and wizards, file formats (Markdown-folder sync, Structurizr DSL import, Gherkin export, and the .radical/ editor-state formats for the canvas selection, the Forge run status and the model's base, formats/modelBase.ts), query language, the headless model facade, the AI tool catalogue and system prompt, Radical Forge's stages, prompts, views and Hub matching, the Hub concept import, radical check's rule catalogue, report readers and evidence (src/check), the model change report (src/modelChanges.ts: what changed between two versions of a model, layout left out, with old and new values, ancestors and relations) and the branch's changes in Studio (src/branchChanges.ts: marks and ghosts, the changes per view, the words that changed, and how far each changed requirement and ADR has got by the test report). The pure wiki document builder (src/wikiDocument.ts) supplies Studio and CLI exports with the same scope, hierarchy, fields, requirement prose, relationship groups and content blocks. No UI or browser dependencies.
