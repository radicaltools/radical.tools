---
id: "0ed4271c-bfc7-45ba-a874-fc3340b339c9"
type: "scenario"
label: "Open a model folder"
given: "a model is kept as a Markdown folder and the welcome screen is shown"
tests: "apps/e2e/tests/studio/folders.spec.ts › Open → Folder… on the welcome screen opens a model folder"
then: "the welcome screen closes, the model's elements show on the canvas, and the Models dialog marks it as folder-backed"
when: "the user chooses Open → Folder…"
---
