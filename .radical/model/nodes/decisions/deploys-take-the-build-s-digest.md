---
id: "d2567b83-d48f-4fef-be18-0866b613f574"
type: "fitness-fn"
label: "Deploys take the build's digest"
cadence: "triggered"
characteristic: "reliability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

radical.tools has one environment and ships static files: tools/ci/workflows.mjs (npm run check:workflows, tested in tools/ci/workflows.test.mjs) fails when a workflow other than deploy.yml deploys (signs in to the cloud or runs aws s3 or aws cloudfront), when deploy.yml's deploy job uploads before it builds or builds anything after its upload began, when a build command runs twice in deploy.yml, or when it deploys another run's artifact. No image digest: what is uploaded is what the job built once. The E2E suite deploy.yml runs first tests its own build of the same commit, not these bytes.

Threshold: 0 deploys outside deploy.yml; 0 builds after the upload began or run twice; 0 deploys of another run's artifact

Tool: tools/ci/workflows.mjs (js-yaml), run as npm run check:workflows in ci.yml
