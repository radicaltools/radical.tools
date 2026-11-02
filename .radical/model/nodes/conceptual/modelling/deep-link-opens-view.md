---
id: "297a8c8e-57a5-4509-979d-e2a50892fb7c"
type: "requirement"
label: "Deep link opens view"
action: "Studio shall open that view in that perspective and keep the URL in sync with the active view and perspective."
ears_type: "event-driven"
rationale: "Views are shared and bookmarked by link. Evidence: apps/studio/src/renderer/src/route.ts:9-22, 160-190; apps/studio/tests/route.test.ts:4-90; manual#views"
trigger: "Studio is opened with a link naming a perspective and a view, or the user switches view or perspective"
---
