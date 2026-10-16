---
id: "67e8199c-9c68-4ca4-9cbe-28b449acf5a4"
type: "component"
label: "Inspector"
technology: "React"
---

The Inspector perspective (components/Inspector.tsx with components/inspector/: ModelTab, ImplementationTab, ThisChange, ChangesTab, SettingsTab, settingsDraft, shared; persistence/inspector.ts, navigation.ts): runs checkModel on the model as it is edited with the folder's check.json and .radical/test-results.json, shows it in the tabs Model quality and Implementation with a link to every element it names (its panel, Peek); when the folder holds a base, heads Implementation with This change (the requirements and ADRs changed since it, each with what the tests say, and the new ones verified in the tab's label) and adds a Changes tab (the base and its age, with the commands that save it again when it is old, and every element added, changed with its fields and removed, and the relations; a click on an element opens Designer's properties card, read-only, with its changes and Show on canvas and Open wiki page, over the page so nothing beneath moves); edits check.json in Settings (goals, severities, baselines, test-unbound files; Ratchet; the change marked when it loosens the gate, and its diff) and saves it with saveCheckConfig, and the toolbar button with the error and warning counts, enabled by a check report or a base. Its content is up to 1640 px wide.
