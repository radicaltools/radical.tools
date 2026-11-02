---
id: "2b5f0e2b-5e61-4692-99f8-1e1289520ad2"
type: "scenario"
label: "Low card keeps its name"
given: "a container card 120 px high with a long description and technology"
metrics: "test(apps/e2e/tests/studio/canvas-detail.spec.ts › a low card keeps its name whole and cuts its description at the last line that fits) passed"
then: "its name is drawn whole, its technology on one line, and its description shows only whole lines that fit under them, the last cut with an ellipsis"
when: "the canvas draws it"
---
