---
id: "a8d85e43-4d58-4cae-b61a-4de9f457194a"
type: "fitness-fn"
label: "Superseded runs cancelled, deploys never"
cadence: "triggered"
characteristic: "reliability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

tools/ci/workflows.mjs concurrency (npm run check:workflows, tested in tools/ci/workflows.test.mjs) fails when a workflow run by pull requests does not cancel its superseded runs (cancel-in-progress true, or an expression true on pull_request), or when a deploy job (one with an environment, a cloud sign-in, or aws s3 or cloudfront steps) is outside a concurrency group or in one that cancels a deploy in progress. deploy.yml's job deploys in the group deploy-production; release.yml cancels only superseded pull-request runs, never a tag build.

Threshold: 0 workflows run by pull requests that do not cancel superseded runs; 0 deploy jobs outside a concurrency group, or in one that cancels in progress

Tool: tools/ci/workflows.mjs (js-yaml), run as npm run check:workflows in ci.yml
