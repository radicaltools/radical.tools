---
id: "e3f93dc0-7070-42c9-8480-649e366a328b"
type: "requirement"
label: "Focus a found node"
action: "Studio shall pan and zoom the canvas to that node once the run finishes."
ears_type: "event-driven"
rationale: "Navigation by plain language is part of asking about the model. Evidence: packages/common/src/ai/tools/modelTools.ts:18-27,54-60; apps/studio/src/renderer/src/components/QuickSearch.tsx:131-140"
trigger: "the assistant answers a \"show me\" or \"find\" request with focus_node"
---
