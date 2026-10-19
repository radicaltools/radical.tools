---
id: "51b11ee7-e80c-469e-970c-95670b36f70f"
type: "scenario"
label: "Mockups on a Screen flow canvas"
given: "a Forge run with the Layer canvases structure whose requirements are on Conceptual"
tests: "packages/common/tests/forgeViews.test.ts › mockups go onto a Screen flow canvas of their own"
then: "both mockups are on Conceptual and on a new Screen flow canvas that lists only them, so it shows the navigates-to between them and not the requirement; Screen flow is the Mockups stage's view and the Arrange questions cover it"
when: "the Mockups stage adds two mockups that illustrate a requirement and one navigates to the other"
---
