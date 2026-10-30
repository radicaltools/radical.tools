---
id: "92192413-93d1-4f30-b9f1-8d9e52e5cffb"
type: "scenario"
label: "Tree layout for a view"
gherkin: "# Not covered by an automated test"
given: "a view whose Auto-layout is set to Hierarchical nested tree in its properties"
metrics: |
  test(apps/studio/tests/treeLayoutParts.test.ts › Tree Layout on view-core leaves no siblings on each other) passed
  test(apps/studio/tests/treeLayoutParts.test.ts › Tree Layout on view-payments leaves no siblings on each other) passed
  test(apps/mcp/src/folderModel.test.ts › long Smart Layout runs › lays out a view set to "Hierarchical nested tree" as a tree, as Studio does) passed
then: "the elements are arranged as a top-down hierarchy, nested children also top-down, and Studio reports that the tree layout was applied"
when: "the user clicks the Tree Layout button"
---
