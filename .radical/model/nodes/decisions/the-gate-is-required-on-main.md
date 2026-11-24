---
id: "80210184-8ca0-4fce-a5f7-d7006aad16e8"
type: "fitness-fn"
label: "The gate is required on main"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
measure: "github-actions"
metrics: "ci.required-checks >= 1"
scope: "atomic"
trigger: "nightly"
---

Every night radical sense github-actions counts the status checks the rules of main require (classic branch protection and the rulesets that apply, together), and the model fails below one. The gate job below is the check to require: it runs whatever happened before it (if: always()) and fails unless every job it needs succeeded, so a failed job and the skipped jobs after it cannot pass as green. The ruleset itself (no direct pushes, no force pushes, the approvals) is checked by the Code review and branching pack.

Threshold: At least 1 required status check on main (the gate job ci among them); the gate fails when any job it needs did not succeed

Tool: radical sense github-actions; GitHub Actions (the gate job)

```yaml
# .github/workflows/ci.yml: the pull-request pipeline; its last job, ci, is the check the ruleset of main requires
name: ci
on:
  pull_request:
concurrency:
  group: ci-${{ github.event.pull_request.number }}
  cancel-in-progress: true
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1          # pin by commit SHA in your repository
      - uses: docker/setup-buildx-action@v4.4.1
      - uses: docker/build-push-action@v7.4.0
        with:
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
  # … actionlint and every other job of this workflow, each named in needs below
  ci:
    if: always()
    needs: [build]                               # every other job of this workflow
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      - name: Every job succeeded (a skipped or cancelled job is no pass)
        env:
          RESULTS: ${{ toJSON(needs.*.result) }}
        run: echo "$RESULTS" | jq -e 'all(. == "success")'
```
