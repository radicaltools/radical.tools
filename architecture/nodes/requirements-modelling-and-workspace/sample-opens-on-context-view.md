---
id: "3971302f-f5b9-41ef-9b08-43efc39a5c02"
type: "requirement"
label: "Sample opens on context view"
action: "Studio shall create a local copy of the Fintech Banking Platform sample and open it on its System Context view."
ears_type: "event-driven"
rationale: "Landing on the System Context view instead of all 65 elements at once makes the first look readable. Evidence: apps/studio/src/renderer/src/components/WelcomeScreen.tsx:127-156,298-325; manual#getting-started"
trigger: "the user opens the sample from the Welcome screen"
---
