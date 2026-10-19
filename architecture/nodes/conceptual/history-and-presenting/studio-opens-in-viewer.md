---
id: "70629072-1566-4fb9-a987-d2100f323650"
type: "scenario"
label: "Studio opens in Viewer"
given: "a model in the browser's storage"
tests: "apps/e2e/tests/studio/views.spec.ts › Studio opens a model in Viewer unless a link names a perspective, and a new model in Designer"
then: "the model shows in Viewer with no palette and the address names viewer; the link opens Designer; the new model opens in Designer"
when: "Studio is opened without a route and the model is picked on the welcome screen; then it is opened from a link to Designer; then a new model is created"
---
