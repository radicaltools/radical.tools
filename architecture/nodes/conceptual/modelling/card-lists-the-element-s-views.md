---
id: "e5441ba9-8685-487f-8a3a-38d82ea5212e"
type: "requirement"
label: "Card lists the element's views"
action: "the properties card shall list, in a Views section with their number, every view that shows the element (what its filter's chain gives, else the elements it lists, or every element when it shows the whole model; a group of views per element through its views), in model order, each with its name and view type and the open one marked, say so when no view shows it, and on a click on one open that view with the element selected, its containers open and the camera on it on a canvas, its page on a wiki; from the Inspector's card in Designer"
ears_type: "event-driven"
rationale: "An element sits on several views; finding the others meant opening each view or searching. The views are counted the way the view list counts them (viewShownNodes), so the card and the list agree. Evidence: packages/common/src/model.ts (viewsShowingNode), packages/ui/src/components/RightPanel.tsx (ElementViews, useViewsShowing), packages/ui/src/store/showInView.ts (showNodeInView, showOnPage, focusWhenDrawn), apps/studio/src/renderer/src/navigation.ts (revealOnCanvas), apps/studio/src/renderer/src/components/Inspector.tsx; manual#workspace"
trigger: "the user selects one element"
---
