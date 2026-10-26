---
id: "67300b9d-30bb-4198-a8c4-0ba1aee0cdf6"
type: "requirement"
label: "Export view as image"
action: "Studio shall download the current canvas as a PNG or SVG image, without panels, toolbars, background grid or any editing control (each carries one mark the export leaves out: the discussion icons, an exploration's bar and the + and − of its elements, the + menu, the relation and Discuss menus, the connect pills, the pin, the alignment guides and their buttons, a frame's − and +, the reconnect handles, and the milestone chip's buttons and unsaved mark, its name and change counts staying as a caption), and without the selection or Focus's dimming, named after the model, the view and the active milestone."
ears_type: "event-driven"
rationale: "A picture of a view can be shared where the tool is not available. The discussion icons beside the elements, and an exploration's bar and its + and −, were drawn in the picture (round 185–192, 2026-10-26, F-0067). The pin, the alignment guides, a frame's − and + and the selection were drawn in the picture (F-0088, round 193–200, 2026-10-26). Evidence: apps/studio/src/renderer/src/hooks/useExport.ts (export filter); apps/studio/src/renderer/src/hooks/useExport.ts:35-70; apps/studio/src/renderer/src/components/Toolbar.tsx:472-490; manual#workspace; packages/ui/src/components/editingControl.ts; apps/studio/src/renderer/src/hooks/useExport.ts (exportFilter, drawForExport)"
trigger: "the user chooses Export as PNG… or Export as SVG… under Export on the activity rail"
---
