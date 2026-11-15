---
id: "75b84916-e58c-4e25-8734-ee0a70c637fb"
type: "requirement"
label: "Inspector settings saved"
action: "write the goals, the rules' severities and baselines and the test files test-unbound looks at, only what the Settings draft changed from the Settings it was made from, over check.json and .radical/radical.json as they are at Save (where both changed a value, the save wins; a file with no change is not written; an agent's test bindings are never touched), and check the model with them at once"
ears_type: "event-driven"
rationale: "The project sets up its gate where it reads the result, and CI reads the same file. Ratchet in Settings lowers each baseline of the draft to what the check finds, as --ratchet does. Evidence: apps/studio/src/renderer/src/components/inspector/SettingsTab.tsx, settingsDraft.ts (patchRule, setGoal, lineDiff), persistence/inspector.ts (saveCheckConfig), packages/node-files/src/selectionFile.ts (writeCheckConfig), apps/studio/src/renderer/src/persist/webFolder.ts (writeCheckConfigToHandle). Save wrote the whole draft over the files as last polled, dropping a binding an agent made meanwhile (F-0158, round 211–220; settingsBases, settingsOf, readCheckFiles)."
trigger: "the user saves the Inspector settings of a model kept in a folder"
---
