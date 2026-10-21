---
id: "5d5e9da2-94be-44e0-ab09-67979ec3685d"
type: "requirement"
label: "Import Structurizr DSL"
action: "Studio shall convert the workspace's elements and relations into a new local-storage model named after the workspace, reading an enterprise block as part of the model, skipping a relationship's own block and other named blocks (deployment environments) without losing what follows, and reading a # line as a comment."
ears_type: "event-driven"
rationale: "Teams coming from Structurizr keep their existing model. Evidence: apps/studio/src/renderer/src/components/DocumentManager.tsx:141-172,261; packages/common/src/formats/structurizrDsl.ts; manual#documents"
trigger: "the user imports a .dsl file with Import Structurizr DSL…"
---
