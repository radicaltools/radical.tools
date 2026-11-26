---
id: "fabcad46-835a-452b-ac61-5c52f8f1ff89"
type: "requirement"
label: "A run of some tests keeps the rest"
action: "replace in the kept results the results of the test files the reports have and leave those of the other files as they were, judge the model by both, say how many results it kept and since when, and record that with the results, which the Inspector's Tests chip then says; results of CI read with --from-ci shall still replace them whole; and the kept results shall be written so that what reads them never finds a file half written"
ears_type: "event-driven"
rationale: "A local check of one test file made every other test of the model a test that did not run, and the implementation's metrics fell to nothing until the next whole run (the user, 2026-11-26: the previous results stay in force meanwhile). CI starts without kept results, so its gate reads only its own reports. A file that leaves the reports for good keeps its last results until CI's results of a later commit replace them. Evidence: packages/common/src/check/files.ts (withEarlierResults, KeptCases), apps/cli/src/check.ts (runCheck, writeBeside), apps/studio/src/renderer/src/components/inspector/Freshness.tsx"
trigger: "radical check reads test reports with --report while test results are kept beside the model"
---
