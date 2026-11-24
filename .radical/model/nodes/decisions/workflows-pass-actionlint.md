---
id: "6fd21664-6402-4869-b26d-61cdf1ef681e"
type: "fitness-fn"
label: "Workflows pass actionlint"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

The job Workflows of ci.yml runs actionlint over every workflow file (npm run lint:workflows, tools/ci/actionlint.mjs): syntax, expressions and their types, needs between jobs, inputs of reusable workflows, and in CI the shell scripts of run steps through shellcheck. The gate job ci needs it, so it blocks a merge. tools/ci/actionlint.test.mjs runs it over the repository's workflows and over a broken sample.

Threshold: 0 actionlint findings in .github/workflows on every pull request; the job is one the gate job ci needs

Tool: actionlint 1.7.12 (rhysd/actionlint image pinned by digest in CI, the release binary checked by its SHA-256 elsewhere)
