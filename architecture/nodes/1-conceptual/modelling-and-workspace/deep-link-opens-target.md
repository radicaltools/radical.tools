---
id: "8333fff2-82e0-49da-aa0e-6998d1609b52"
type: "requirement"
label: "Deep link opens target"
action: "Studio shall skip the Welcome screen and apply the route's document, perspective, view, element, milestone and slide, falling back to the default Structure view when the view does not exist."
ears_type: "event-driven"
rationale: "A shared link must land on its destination, and a stale link must still open something sensible. Evidence: apps/studio/src/renderer/src/App.tsx:50-56; apps/studio/src/renderer/src/route.ts:55-80,142-232; apps/studio/tests/route.test.ts:63-90; manual#links; manual#getting-started"
trigger: "Studio is opened with a route in the URL hash"
---
