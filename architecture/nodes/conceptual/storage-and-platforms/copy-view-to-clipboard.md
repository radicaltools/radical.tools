---
id: "4523a725-01e5-4690-be8e-2d4d1934e46f"
type: "requirement"
label: "Copy view to clipboard"
action: "Studio shall copy a PNG picture of the view shown, of any kind, to the clipboard, without panels, toolbars and background grid and with every relation label shown."
ears_type: "event-driven"
rationale: "The fastest way to put a view into a chat or a document. Evidence: apps/studio/src/renderer/src/hooks/useExport.ts (copyToClipboard, EXPORT_TARGETS, showAllEdgeLabels), apps/studio/src/renderer/src/components/Toolbar.tsx."
trigger: "the user chooses Copy to clipboard under Export on the activity rail"
---
