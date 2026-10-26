---
id: "67300b9d-30bb-4198-a8c4-0ba1aee0cdf6"
type: "requirement"
label: "Export view as image"
action: "Studio shall download the current canvas as a PNG or SVG image, without panels, toolbars, background grid and editing controls (the discussion icons, an exploration's bar and the + and − of its elements, the + menu, the relation and Discuss menus, the connect pills), named after the model, the view and the active milestone."
ears_type: "event-driven"
rationale: "A picture of a view can be shared where the tool is not available. The discussion icons beside the elements, and an exploration's bar and its + and −, were drawn in the picture (round 185–192, 2026-10-26, F-0067). Evidence: apps/studio/src/renderer/src/hooks/useExport.ts (export filter); apps/studio/src/renderer/src/hooks/useExport.ts:35-70; apps/studio/src/renderer/src/components/Toolbar.tsx:472-490; manual#workspace"
trigger: "the user chooses Export as PNG… or Export as SVG… under Export on the activity rail"
---
