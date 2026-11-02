---
id: "40f6c0ad-e841-4535-94a9-b039ccb174fc"
type: "requirement"
label: "Schema checks model JSON"
action: "The VS Code extension shall validate .c4.json and .radical files opened as text against its bundled JSON schema of the model format, with completion and error highlighting."
ears_type: "ubiquitous"
rationale: "Evidence: apps/vscode/package.json (jsonValidation), apps/vscode/schemas/c4.schema.json. Note: the schema forbids unknown top-level keys and does not list defaultLayoutConstraints or hubTemplates, which Studio writes (packages/common/src/c4.ts DiagramData)."
---
