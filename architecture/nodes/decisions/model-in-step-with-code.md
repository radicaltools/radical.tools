---
id: "e32b7ec0-3949-40dd-bbeb-f89bfd9b2954"
type: "fitness-fn"
label: "Model in step with code"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

The CI job "Architecture model" (.github/workflows/ci.yml) runs radical check architecture --report reports with the unit test reports and the e2e report of the same run, and fails on any error under architecture/check.json: a test a scenario or fitness function names that failed or is gone, a requirement, need, ADR or fitness function left incomplete, or a gap above its baseline. Review still covers what no rule can see, such as a new app or dependency the model does not show.

Threshold: radical check architecture reports no errors in CI on every pull request
