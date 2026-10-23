---
id: "bf78c97e-ef63-4a75-815c-a2cfee30f0aa"
type: "requirement"
label: "Edit node types"
action: "The metamodel editor shall let the user name the metamodel (an emptied name going back to the one it had) and add node types and edit each type's label (an emptied label going back to the one it had, as a relation type's and a property's do), description (shown by the wiki), fill and text colour, default width and height, minimum and maximum instances, allowed parent types and whether it may sit at the top level, summary in tables (a template of {property} tokens, parts in [ ] left out when empty, listing the type's tokens and showing how it reads on one of its elements, the built-in template when empty), and properties."
ears_type: "ubiquitous"
rationale: "Teams adapt the notation to their own vocabulary per document, and what a table row says about an element is part of what its type means. Evidence: apps/studio/src/renderer/src/components/MetamodelEditor.tsx (NodeTypeCard, SummaryField), packages/common/src/nodeSummary.ts (summaryTemplate, summaryTokens, DEFAULT_SUMMARIES), packages/common/src/ai/tools/metamodelTools.ts (upsert_node_type summary); manual#metamodel"
---
