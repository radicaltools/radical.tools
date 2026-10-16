---
id: "ca0da36a-3120-4ea4-94ee-d96d5ae4f465"
type: "requirement"
label: "This change in the Inspector"
action: "the Inspector's Implementation tab shall list the requirements and ADRs added, changed and removed since the base, each with what the last test report says of it (verified, failing, test not written, no scenario; changed while none of its scenarios changed; removed while a test of its scenarios still runs), count the new ones verified, and show that count in the tab's label"
ears_type: "state-driven"
precondition: "the open model folder holds .radical/base.json"
rationale: "With the model first, the change is the work to do; the tests say how far it got, and the two warnings catch what the check cannot see: a requirement that changed under unchanged tests, and tests left behind by a removed one. Evidence: packages/common/src/branchChanges.ts (changeWork), apps/studio/src/renderer/src/components/inspector/ThisChange.tsx, apps/studio/src/renderer/src/components/Inspector.tsx"
---
