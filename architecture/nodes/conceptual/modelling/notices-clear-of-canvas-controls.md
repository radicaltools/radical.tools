---
id: "dd3ec179-3d46-450f-8afc-0d4bf246b7a1"
type: "requirement"
label: "Notices clear of canvas controls"
action: "Studio shall show it above the canvas controls, never over them, and remove it after 5 s unless the user moves the pointer onto it, a pointer resting where the notice appears not keeping it."
ears_type: "event-driven"
rationale: "Notices stood over the canvas controls at the bottom right, hiding Smart Layout and Fit All, and one that appeared under a resting pointer never went away (run 183, 2026-10-23, F-0050). Evidence: packages/ui/src/components/NotificationHost.tsx; packages/ui/src/index.css (.toast-host)"
trigger: "Studio shows a notice"
---
