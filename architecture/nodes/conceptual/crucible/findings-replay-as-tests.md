---
id: "31bc6fb0-a477-4c1b-995c-483cc40492cf"
type: "requirement"
label: "Findings replay as tests"
action: "the system shall report a test case for each hardened or fixed finding of that file, which replays the finding's shrunk sequence in its world once, without fast-check and without the known failures, and fails when a rule breaks"
ears_type: "event-driven"
rationale: "The test a fuzz finding needs is its own steps: written once by the fuzzer, never by hand, and it keeps failing until the bug is fixed, whatever the known list says."
trigger: "a fuzz file runs with its project's findings folder"
---
