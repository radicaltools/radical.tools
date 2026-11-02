---
id: "d2142a21-2366-4e4d-a9ab-adf3d535a388"
type: "requirement"
label: "Sync wiki discussions"
action: "The CLI shall sync new node footer threads and replies in both directions using stable IDs, preserve existing content and author provenance, and hold uncertain creates or unsupported content for review without automatically retrying writes."
ears_type: "event-driven"
rationale: "Manual discussion exchange is independent of one-way generated wiki content publication; one designated runner keeps discussions and durable sync state together."
trigger: "the user confirms a preview for a managed Confluence wiki tree"
---
