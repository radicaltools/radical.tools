---
id: "e52f9956-98dc-44a7-bd7b-31144e2e465b"
type: "fitness-fn"
label: "A checked tree is not checked again"
cadence: "triggered"
characteristic: "performance-efficiency"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

tools/ci/checked.mjs decides both halves, and tools/ci/checked.test.mjs tests them on sample runs and on the repository's own workflows: a run marks its tree only when every job passed, E2E among them, and no new screenshot baseline was written; a tree counts as checked only for an unexpired mark of a completed, successful run of ci.yml of this repository; ci.yml marks in its gate job after the gate, and deploy.yml asks before its E2E suite, leaves the suite and the deploy job's checking steps out only for a checked tree, and deploys when the suite passed or the tree was checked.

Threshold: 0 deploys that neither ran the checks nor found a mark of their tree; 0 marks of a tree a run did not check whole

Tool: tools/ci/checked.mjs (node), tested in tools/ci/checked.test.mjs with npm run test:tools
