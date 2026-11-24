---
id: "65adadc6-1f32-41ff-a8b4-8f2e01920250"
type: "fitness-fn"
label: "CI runs what verify runs"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

tools/ci/workflows.mjs verify (npm run check:workflows, tested in tools/ci/workflows.test.mjs) collects the run steps of ci.yml, leaving out the gate job ci and the jobs that commit to the repository (contents: write), and fails on any that is not npm ci or npm run <script>, and on any such script that npm run verify does not reach, also through the scripts it calls; so npm run verify on a developer's machine runs what CI runs. release.yml's packaging build on pull requests is left out.

Threshold: 0 run steps of ci.yml (the gate job and committing jobs aside) other than npm ci and npm run <script>; 0 such scripts npm run verify does not reach

Tool: tools/ci/workflows.mjs (js-yaml), run as npm run check:workflows in ci.yml
