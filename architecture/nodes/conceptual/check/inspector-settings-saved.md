---
id: "75b84916-e58c-4e25-8734-ee0a70c637fb"
type: "requirement"
label: "Inspector settings saved"
action: "write the goals, the rules' severities and baselines and the test files test-unbound looks at to the folder's check.json, keeping what was not changed as it was, and check the model with them at once"
ears_type: "event-driven"
rationale: "The project sets up its gate where it reads the result, and CI reads the same file. Ratchet in Settings lowers each baseline of the draft to what the check finds, as --ratchet does. Evidence: apps/studio/src/renderer/src/components/inspector/SettingsTab.tsx, settingsDraft.ts (patchRule, setGoal, lineDiff), persistence/inspector.ts (saveCheckConfig), packages/node-files/src/selectionFile.ts (writeCheckConfig), apps/studio/src/renderer/src/persist/webFolder.ts (writeCheckConfigToHandle)"
trigger: "the user saves the Inspector's Settings of a model kept in a folder"
---
