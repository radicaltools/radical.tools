---
id: "4f13dd13-ae13-4249-ac30-6030d6785bc6"
type: "scenario"
label: "Gate on a fix"
given: "a git repository with a bug fixed in the working tree and a test of it"
tests: |
  apps/cli/src/harden.test.ts › radical harden --gate › passes a test that fails without the fix and passes with it every time
  apps/cli/src/harden.test.ts › radical harden --gate › fails a test that passes without the fix
  apps/cli/src/harden.test.ts › radical harden --gate › fails a test that fails now and then
  apps/cli/src/harden.test.ts › radical harden --gate › leaves the working tree as it found it
  apps/cli/src/harden.test.ts › puts the fix back when it is interrupted (SIGINT to the process group, as Ctrl+C does)
  apps/cli/src/harden.test.ts › puts the fix back when it is interrupted (SIGTERM)
then: "the first passes all three stages; the second fails the fails-first stage, the third the flakiness stage; each time the working tree is as before"
when: "radical harden --gate runs on the test, on a test that passes without the fix too, and on a test that fails now and then"
---
