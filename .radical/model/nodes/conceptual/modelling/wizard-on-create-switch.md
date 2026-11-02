---
id: "b7216ca7-f9f9-4c54-a308-20e61f79be4e"
type: "requirement"
label: "Wizard on create switch"
action: "Studio shall create new elements immediately without opening their wizard, and leave the other settings (Focus, Smart fit) as the user left them."
ears_type: "optional"
feature: "Wizard on create is turned off under Settings on the activity rail"
rationale: "Experienced users who add many elements need to skip the guided form. Every writer of the studio settings stored all of them as it had read them, so changing Wizard on create turned Focus and Smart fit back on after a reload (run 179, 2026-10-23, F-0039); each now changes only its own setting over the ones stored. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx:431-442; packages/ui/src/studioSettings.ts (updateStudioSettings); packages/ui/src/store/diagramStore.ts:1488; packages/ui/tests/nodeWizard.test.ts:68; manual#properties"
---
