---
id: "e800236f-2633-4596-995e-667c46b64d7d"
type: "scenario"
label: "New model gets the metamodel's views"
given: "the welcome screen, and the engine with the Radical and C4 metamodels"
metrics: |
  test(packages/common/tests/viewStructure.test.ts › metamodelViews › makes a view of each chosen viewpoint in its folder, and a group for one that draws one element) passed
  test(packages/common/tests/viewStructure.test.ts › metamodelViews › makes only All elements for no viewpoints, and leaves out those the metamodel lacks) passed
  test(apps/e2e/tests/studio/boot.spec.ts › first visit › a new model starts with the metamodel's views in their folders, or with none) passed
then: "Views of the metamodel is checked and Customise… lists the metamodel's viewpoints by folder, fewer for C4; the model opens on the All elements table with no elements, the Structure view All elements first in the list under it, and its views in the folders Conceptual, Logical and Governance, a viewpoint that draws one element as a group; the Empty model has no views; the engine makes the All elements Structure view, then a view of each chosen viewpoint in its folder in the list's order, a wiki written as one article, a group for a viewpoint that draws one element, which gets a view once such an element is added, and only the All elements view for no viewpoints"
when: "the user chooses New model, opens Customise…, switches the metamodel to C4 and back, and presses Create model; then creates another with Empty; and the engine makes the views of the chosen viewpoints"
---
