---
id: "a08bf988-b002-4a3d-b765-e5a41f705b7c"
type: "requirement"
label: "Export non-canvas views"
action: "download a picture of that view, named after the model, the view and the active milestone"
ears_type: "event-driven"
rationale: "The export menu items did nothing on views without a canvas, with no file and no notice. Evidence: apps/e2e/tests/studio/export.spec.ts"
trigger: "the user chooses Export as PNG… or Export as SVG… while a view without a canvas (table, wiki, matrix or hierarchy) is active"
---
