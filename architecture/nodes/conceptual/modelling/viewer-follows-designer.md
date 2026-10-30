---
id: "4ec239d6-4d90-44e3-a003-94e5f79b04bc"
type: "scenario"
label: "Viewer follows Designer"
given: "System Context and Containers placing their shared elements far apart"
metrics: "test(apps/e2e/tests/studio/views.spec.ts › Viewer › Viewer opens on what Designer showed, then shows each view with its own layout) passed"
then: "Viewer shows System Context with every element where Designer had it, and Containers with the layout it has when it is loaded first"
when: "the user switches from Designer on System Context to Viewer, then opens Containers"
---
