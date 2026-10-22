---
id: "fd880aed-6430-4737-bb41-ba2b52192a87"
type: "requirement"
label: "Narrowing the metamodel asks"
action: "Studio shall make the change only after a confirmation that lists what it breaks, and the MCP server shall write it and report with its result what it breaks; Validation and get_issues then list each element it leaves breaking a rule"
ears_type: "event-driven"
rationale: "Narrowing the metamodel changed it silently, leaving elements that broke the new rules with nothing saying so. The maintainer decided on 2026-10-21 (D3, exploratory runs 45 to 64) that it is allowed after a confirmation listing what it breaks, with the same warning over MCP. Exploratory runs 65 to 69 (2026-10-21, item 242) found deleting a type, Reset to C4 preset and adding a relation type with no pairs going through without that question. Evidence: packages/common/src/metamodel/validate.ts (metamodelChangeBreaks), packages/ui/src/store/diagramStore.ts (removeRelationType, removeNodeType, resetMetamodelToC4), apps/studio/src/renderer/src/components/MetamodelEditor.tsx (confirmNarrowing), packages/common/src/ai/tools/metamodelTools.ts"
trigger: "the user in the metamodel editor, or an agent with a metamodel tool, narrows the metamodel below what the model holds: takes away an allowed parent (the last one too, which leaves the type no parent) or At the root, lowers a maximum count, removes an enum option in use, makes a property required that elements leave empty, turns a reference that holds several into a single one, deletes a relation or node type, resets it to the C4 preset, or adds a relation type with no pairs that untyped relations would then be flagged against"
---
