---
id: "e3eb8408-68ed-4b18-87dd-6ea7f7666883"
type: "requirement"
label: "Agent edits metamodel types"
action: "add the type or change only the fields given (label, description, colours, allowed parents, root placement, maximum count, own table tab and properties for a node type; reading labels and allowed pairs for a relation type), refusing an unknown parent or pair type, an enum property without options, a reference property without a target type and a property key another field has"
ears_type: "event-driven"
rationale: "Agents can extend the notation the way the metamodel editor does, under the same key rules; the fork of a built-in preset is a requirement of its own. Evidence: packages/common/src/ai/tools/metamodelTools.ts (upsert_node_type, upsert_relation_type, parseProperties), apps/mcp/src/catalogueTools.test.ts › copies a built-in metamodel on the first edit, persists it and refreshes tool schemas"
trigger: "an agent calls upsert_node_type or upsert_relation_type"
---
