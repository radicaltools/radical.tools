---
id: "79ce09f0-1b75-422e-b261-99e084a967d5"
type: "requirement"
label: "Setup again from Settings"
action: "Studio shall open the Setup wizard at its first step, showing the settings in use now."
ears_type: "event-driven"
rationale: "The wizard is the one place that explains each setting; it stays reachable after the first start. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx (Settings → Setup…)"
trigger: "the user chooses Setup… in the activity rail's Settings menu"
---
