---
id: "465f5a55-2988-4383-a028-11291c548659"
type: "requirement"
label: "Settings wait for Save"
action: "the Inspector shall keep them for that model while the user opens another tab or goes Back and returns, mark the Settings tab as unsaved, and write nothing to check.json until Save"
ears_type: "state-driven"
precondition: "the Inspector's Settings hold changes not saved yet"
rationale: "Changes made in Settings were lost on a switch to another tab or a Back, with nothing saying so (exploratory runs 45 to 64, 2026-10-21). The drafts live in memory only. Evidence: apps/studio/src/renderer/src/components/inspector (Settings draft per model, unsaved pill)"
---
