---
id: "10e933f8-41da-413b-a0bc-a0e5295886db"
type: "requirement"
label: "Table tabs per type"
action: "The table view shall offer an All Nodes tab with the containment tree as indented rows, one tab per node type the metamodel marks as a table tab, and a Relations tab, each with its row count, and shall remember the active tab per view."
ears_type: "ubiquitous"
rationale: "Governance registers need columns that fit each kind of element. Evidence: packages/ui/src/components/TableView.tsx:117-142, 165-198, 234-276, 600-625; packages/common/src/metamodel/presets/governance.ts:49, 99, 155, 207, 330, 390, 423; manual#view-table"
---
