---
id: "b852859c-e339-4c2f-8334-d276a6a50365"
type: "requirement"
label: "Ten-engine candidate ensemble"
action: "Smart Layout shall generate candidate layouts from ten structurally different engines: five ELK layered variants, a metamodel-aware layered layout, stress majorisation, force-directed, Mr.Tree and the semantic C4 layout."
ears_type: "event-driven"
rationale: "No single algorithm suits every graph shape, so running several families and picking among them is what makes one button work on any view. Evidence: packages/layout/src/smartLayout.ts:1102-1191, packages/layout/src/smartLayout.ts:575-657; packages/ui/src/components/SmartLayoutButton.tsx:131-164; packages/layout/tests/layoutPipeline.test.ts:113; manual#layout"
trigger: "the user clicks Smart Layout on a canvas view"
---
