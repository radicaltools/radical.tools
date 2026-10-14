---
id: "c02a7689-136f-4d05-8b6c-fe64b7442651"
type: "requirement"
label: "Resizable left panel"
action: "Studio shall make the left panel wider or narrower with the drag, between 200 and 560 pixels, keep that width in the browser for the next visit, and go back to the default width of 260 pixels on a double-click."
ears_type: "event-driven"
rationale: "Long view, folder and element names need room in a large model, and screens differ. Evidence: packages/ui/src/components/RightPanel.tsx (LeftPanelResizer), packages/ui/src/index.css (.panel-resize), apps/studio/src/renderer/src/studio.css (--left-panel-w); manual#views"
trigger: "the user drags the left panel's inner edge, or double-clicks it"
---
