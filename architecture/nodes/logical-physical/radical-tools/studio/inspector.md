---
id: "67e8199c-9c68-4ca4-9cbe-28b449acf5a4"
type: "component"
label: "Inspector"
technology: "React"
---

The Inspector perspective (components/Inspector.tsx with components/inspector/: ModelTab, ImplementationTab, ThisChange, SettingsTab, settingsDraft, shared; persistence/inspector.ts, navigation.ts): runs checkModel on the model as it is edited with the folder's check.json and .radical/test-results.json, shows it in the tabs Model quality and Implementation with a link to every element it names, heads Implementation with This change when the folder holds a base (the requirements and ADRs changed since it, each with what the tests say, and the new ones verified in the tab's label), edits check.json in Settings (goals, severities, baselines, test-unbound files; Ratchet; the change marked when it loosens the gate, and its diff) and saves it with saveCheckConfig, and the toolbar button with the error and warning counts.
