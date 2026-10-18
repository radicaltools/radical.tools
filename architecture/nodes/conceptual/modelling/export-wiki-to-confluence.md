---
id: "91b50022-eace-4779-9f5d-44f6e186e62e"
type: "requirement"
label: "Export wiki to Confluence"
action: "the CLI shall export that complete wiki locally as Markdown, Confluence storage XHTML or HTML, or publish it to Confluence Cloud as a browsable page tree by default or a single document by choice; preserve its chain hierarchy, readable fields and clickable relationships; keep one page per element with crosslinks from other occurrences; refresh and move managed pages using stable remote mappings and version checks; resume partial publication; read credentials from environment variables; identify Radical as the source of truth; and leave source model files unchanged."
ears_type: "event-driven"
rationale: "Company readers need a navigable Confluence wiki while Radical remains the authoring model. --structure tree is the publication default; --structure document is optional. --parent-id places or moves the managed export. Content properties keep stable page IDs and resumable state on Confluence rather than in Radical."
trigger: "a user runs radical export confluence for a selected wiki view"
---
