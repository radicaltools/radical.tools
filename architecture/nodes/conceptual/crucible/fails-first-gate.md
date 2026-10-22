---
id: "cb9b43e5-de2b-413a-9e5e-b1475b973491"
type: "requirement"
label: "Fails-first gate"
action: "the CLI shall run the test with the source files changed since the base commit set back to the base (tests and findings kept) and require it to fail, put them back and require it to pass, then run it several times at once (5 by default) and require every run to pass, report each stage, exit with 1 when a stage fails and 2 when it cannot run, and leave the working tree as it found it"
ears_type: "event-driven"
rationale: "A test that does not fail without the fix proves nothing, and one that fails now and then under load blocks CI later; the fix rounds checked both by hand, copying files aside rather than stashing them."
trigger: "the user runs radical harden --gate with a finding or a test"
---
