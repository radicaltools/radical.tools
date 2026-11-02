---
id: "80ad0d61-7922-49d8-919a-0cbdd58f0092"
type: "fitness-fn"
label: "One mark everywhere"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
measure: "brand-mark"
metrics: "brand-mark.exit_code == 0"
scope: "atomic"
trigger: "pull-request"
---

Measured for each element ADR One mark for radical.tools constrains: radical sense run runs the repository's sensor brand-mark (.radical/sensors/sensors.json, .radical/sensors/brand-mark.mjs) once per element. For the element's files (Studio's renderer, the Desktop app's build icon, the VS Code extension's icon, the website, the Hub) it fails when a favicon.svg or Studio's welcome mark is no copy of tools/brand/radical-mark.svg, an icon is missing or not at its size, or a page does not link the favicon or show the mark as its logo. tools/brand.test.mjs checks all of them at once in npm test.

Threshold: every app shows the mark on every pull request
