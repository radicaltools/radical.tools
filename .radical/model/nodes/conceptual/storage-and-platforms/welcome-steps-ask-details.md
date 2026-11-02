---
id: "bae5e8b0-1f2a-4347-b404-0820a74606c8"
type: "scenario"
label: "Welcome steps ask details"
given: "a first visit with no AI provider set up"
metrics: "test(apps/e2e/tests/studio/boot.spec.ts › first visit › New model asks for the metamodel, its views and storage, Open for the source) passed"
then: "New model asks for the metamodel with the Radical metamodel selected, for its views with Views of the metamodel checked and for the storage with In this browser checked, and offers no Create with Radical Forge; Open offers In this browser, File…, Folder… and the sample model"
when: "the user chooses New model, and then Open, on the welcome screen"
---
