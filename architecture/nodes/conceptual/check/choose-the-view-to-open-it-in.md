---
id: "4b62e8bd-8ce0-4edf-a0ce-c862ef2e2367"
type: "requirement"
label: "Choose the view to open it in"
action: "Studio shall list the canvas views (for Show on canvas) or the wiki views (for Open wiki page) that show the element, the smallest first with how many elements each shows, Show on canvas offering All elements when no canvas does and Open wiki page being greyed out when no wiki does, and open the one picked in Designer with the element selected and in sight, its containers open on a canvas, its page on a wiki"
ears_type: "event-driven"
rationale: "An element usually sits on several views; the smallest is a good first guess but not always the one wanted. Evidence: apps/studio/src/renderer/src/navigation.ts (canvasViewsFor, wikiViewsFor, revealOnCanvas, openWikiPage), apps/studio/src/renderer/src/components/inspector/shared.tsx (ChooseView, ShowOnCanvas, OpenWikiPage)"
trigger: "the user picks Show on canvas or Open wiki page for an element in the Inspector (its panel, or its card in the Changes tab)"
---
