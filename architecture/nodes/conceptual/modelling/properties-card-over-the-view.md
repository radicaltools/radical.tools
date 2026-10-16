---
id: "15abbc5b-e254-4559-aee5-8f9dd6ddbd9e"
type: "requirement"
label: "Properties card over the view"
action: "Studio shall slide a properties card over the right side of the view without resizing the view, holding its type, its name as a title edited in place, where it sits (the elements it is in, or a relation's two ends, as links that select them), a Wizard button for a type with a wizard, a ⋯ menu that deletes it and ✕; each short attribute a row of name and value that reads as text and edits in place, empty ones shown as — and a required one with no value marked, each long field rendered as Markdown and edited on a click; hide the card when nothing is selected or several elements are, ✕ hiding it until another selection; keep its width as dragged at its edge; and frame a selection on the canvas in the part the card leaves free."
ears_type: "event-driven"
rationale: "A panel beside the canvas moved the canvas's centre whenever it opened or closed, and its tree of the view's elements repeated what the canvas and the table show. Attributes that read as text and edit in place serve both reading and editing. Evidence: packages/ui/src/components/RightPanel.tsx (RightPanel, PropertiesContent, PanelHeader, AttrRow, AttrValue, MarkdownField), packages/ui/src/components/propertiesCover.ts, packages/ui/src/components/Canvas.tsx (frameNodes, frameSelection, __rfFocusNode), packages/ui/src/index.css (.right-panel, .pp-*), apps/studio/src/renderer/src/studio.css (.app-layout), apps/hub/src/hub.css, apps/e2e/tests/studio/properties-card.spec.ts"
trigger: "the user selects one element, a relation or a sequence"
---
