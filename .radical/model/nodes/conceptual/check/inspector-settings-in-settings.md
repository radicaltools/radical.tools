---
id: "c7064e56-4e11-4734-bdab-5c1eb5a80ee6"
type: "requirement"
label: "Inspector settings in Settings"
action: "open the open model's check.json settings (the goals, the rules' severities and baselines, the test files test-unbound looks at) in a dialog named Inspector settings, saved as Inspector settings saved says, and read-only, saying why, for a model kept in no folder"
ears_type: "event-driven"
rationale: "They are the repository's settings of its gate, not a result of the check (Inspector is a place of the rail); named after the Inspector, which the user knows, at the product owner's word. Evidence: apps/studio/src/renderer/src/components/CheckSettingsDialog.tsx, Toolbar.tsx (AppMenu)"
trigger: "the user picks Inspector settings… in the Settings menu, or a link in the Inspector to the goals or the rules"
---
