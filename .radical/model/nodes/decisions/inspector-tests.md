---
id: "99c8ed33-0e8a-45c5-8e75-daaa5a47f5db"
type: "fitness-fn"
label: "Inspector tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

apps/studio/tests/inspector.test.ts: the Inspector is kept open or closed for the next start, closing it leaves its path, and a link in it shows the element in the perspective open (Presenter going to Viewer) on the view a Quick Search pick opens, selected with its card, or says that the milestone shown lacks it. apps/studio/tests/route.test.ts: the Inspector's tab and path in the route, and links to the perspective of before. apps/studio/tests/inspectorSettings.test.ts: Inspector settings keep check.json as it was where nothing changed, add and remove baselines, goals and test-unbound files, and show a change as a line diff. packages/ui/tests/designerEdit.test.ts: a fix from Viewer or Presenter is Designer's edit, one undo step, refused while a milestone is shown. apps/e2e/tests/studio/inspector-place.spec.ts: the Inspector is a place of the rail, its tabs in the left panel and its report in place of the view, folded as a section. apps/e2e/tests/studio/inspector.spec.ts: on a folder model the button is greyed out until .state/test-results.json appears, Implementation shows the failed test and what it leaves unverified, a link shows the element on its view with its card, a passing run clears the error, the fixes follow the perspective, and Inspector settings flag a loosening change, ratchet, and save goals and rules to check.json.

Threshold: All suites pass in CI (npm test and the e2e suite)
