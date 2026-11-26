---
id: "472f86e2-735f-4228-b1e3-f81dce3b38aa"
type: "requirement"
label: "Finding says what is wrong first"
action: "show a finding, in the Inspector and in an element's card, with what is wrong first, as the name of its rule (in the Inspector the head of its group), and a finding about a test by the test's title, with its file and the describes it is in apart, why it failed as the runner wrote it, what it leaves unverified, and for a test that did not run, was skipped or is not found what that means; show in the Inspector with the finding of a scenario's test what the scenario expects, its given, when and then, and show a finding about a metric condition by the condition and, apart from it, what was measured, by which sensor and how long ago, or that nothing was measured; and radical check's sentence for a test that did not run shall say that it did not run"
ears_type: "ubiquitous"
rationale: "A finding's sentence is written for a log: the verdict comes last, after the element and the whole id of the test, so a title that ends in \"gear changes\" read as \"gear changes failed\", and \"no report has the file of test\" said nothing of what happened to the test (the user, 2026-11-26, with a card's Findings on screen). The parts are fields of the finding (test, reason), not read out of the sentence. Evidence: packages/common/src/check/findingWords.ts (ruleName, testIdentity, testFindingNote), rules.ts (testRule); packages/ui/src/components/ElementVerification.tsx (Finding); apps/studio/src/renderer/src/components/inspector/shared.tsx (FindingRow)"
---
