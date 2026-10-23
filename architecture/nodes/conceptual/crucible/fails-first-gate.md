---
id: "cb9b43e5-de2b-413a-9e5e-b1475b973491"
type: "requirement"
label: "Fails-first gate"
action: "the CLI shall run the test with the source files changed since the base commit set back to the base (tests and findings kept) and require it to fail, put them back and require it to pass, then run it several times at once (5 by default) and require every run to pass, report each stage, exit with 1 when a stage fails and 2 when it cannot run or is interrupted, and leave the working tree as it found it, also when it is interrupted (it stops the test and puts the changed and new files back); where the runner crucible.json gives for the test names a build, run it before the run without the fix and before the run with it, and where it names a repeat command, make the runs at once one run of that command; take a test named by its file and its title, its describe blocks included"
ears_type: "event-driven"
rationale: "A test that does not fail without the fix proves nothing, and one that fails now and then under load blocks CI later; the fix rounds checked both by hand, copying files aside rather than stashing them. Exploratory round 170–175 (2026-10-22, F-0004) found Ctrl+C or SIGTERM during the gate leaving the tree without the fix and its new files deleted, the copies unnamed in a temporary folder. Its fix round (IMPROVEMENTS Dogfooding 46, 47) found the gate unable to judge an e2e test: Playwright served the build made with the fix in both runs, and five Playwright processes fought for the same fixed ports; and a test named with its describe block matched no Vitest test. Evidence: apps/cli/src/harden.ts (setBack, putBack, signal handlers, testRun, buildFor, gate)"
trigger: "the user runs radical harden --gate with a finding or a test"
---
