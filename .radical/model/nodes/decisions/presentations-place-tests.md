---
id: "197e4b19-cfce-4a3d-8d67-ab88c31b62fd"
type: "fitness-fn"
label: "Presentations place tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

apps/e2e/tests/studio/presentation.spec.ts: presentations are a place of the activity rail, just above the Inspector, not a perspective (the switch holds Designer and Viewer, the slides in the left panel one under another, the lit button folds the panel, a section goes back); over Viewer they are only looked through and played, over Designer they are made; a click in another card shows its slide and captures nothing; the slides play and their links open them. apps/e2e/tests/studio/milestones.spec.ts: a slide card in the place names the milestone its slide shows. packages/ui/tests/presenterMode.test.ts and presenterSlides.test.ts: the place's sandbox (appMode 'presenter') saves nothing of the model and restores Designer.

Threshold: All suites pass in CI (npm test and the e2e suite)
