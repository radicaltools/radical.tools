---
id: "dad2535d-c7d6-4564-a9c2-6c65cc5e1032"
type: "requirement"
label: "Wiki page remembered and linkable"
action: "Studio shall save the page with the view and put the element id into the deep link, so reopening the view or the link lands on that page."
ears_type: "event-driven"
rationale: "Reviewers share links to specific documentation pages. Evidence: packages/ui/src/store/diagramStore.ts:2379-2386; apps/studio/src/renderer/src/route.ts:11-16, 105-118, 179-185; apps/studio/tests/route.test.ts:9-15; manual#view-wiki"
trigger: "the user opens an element page in a wiki view"
---
