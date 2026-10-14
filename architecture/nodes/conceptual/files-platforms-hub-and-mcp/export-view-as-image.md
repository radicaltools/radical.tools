---
id: "67300b9d-30bb-4198-a8c4-0ba1aee0cdf6"
type: "requirement"
label: "Export view as image"
action: "Studio shall download the current canvas as a PNG or SVG image, without panels, toolbars and background grid, named after the model, the view and the active milestone."
ears_type: "event-driven"
rationale: "A picture of a view can be shared where the tool is not available. Evidence: apps/studio/src/renderer/src/hooks/useExport.ts:35-70; apps/studio/src/renderer/src/components/Toolbar.tsx:472-490; manual#workspace"
trigger: "the user chooses Export as PNG… or Export as SVG… in the Radical menu"
---
