---
id: "9bed44a4-ea04-45dd-aab7-46930b201dfe"
type: "requirement"
label: "Record explored findings"
action: "the CLI shall write each finding of the report as a finding file (source explore, status open, or question for one that asks for a decision), with its round and run, the rule it breaks, its steps, expected and actual, how often it was seen, and a copy of its script, of the scripts beside it that it imports and of the screenshot it names, numbered after the existing findings, skip a finding whose title a finding of the same round already has, warn about a copied script that names the repository's or the round's absolute paths, and say what it wrote"
ears_type: "event-driven"
rationale: "Findings of exploration live where fuzz findings live, with what replays them, instead of in a document only a person reads. Round 170–175 (2026-10-22, F-0007, IMPROVEMENTS 45) found the screenshot dropped and copied scripts that ran only where the round ran."
trigger: "the user runs radical explore record with a run's report as JSON"
---
