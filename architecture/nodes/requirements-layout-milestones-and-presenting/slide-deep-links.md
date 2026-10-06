---
id: "e3ee8553-e110-47e3-8b6d-9c4fe66e15f0"
type: "requirement"
label: "Slide deep links"
action: "Studio shall keep the presentation id and current slide index in the URL while a presentation is running, and shall start that presentation at that slide when such a URL is opened."
ears_type: "ubiquitous"
rationale: "A listener can open the slide the presenter is on, and a link can start a talk at a given point. Evidence: apps/studio/src/renderer/src/route.ts:12-22, apps/studio/src/renderer/src/route.ts:83-122, apps/studio/src/renderer/src/route.ts:200-220; apps/studio/tests/route.test.ts:35-61; apps/e2e/tests/studio/presentation.spec.ts:38-43; manual#presenting"
---
