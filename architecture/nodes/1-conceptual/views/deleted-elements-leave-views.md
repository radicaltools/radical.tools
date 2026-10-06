---
id: "1533ed1d-a405-4cb8-bc92-491e292d0cc8"
type: "requirement"
label: "Deleted elements leave views"
action: "The system shall remove the element and its descendants from every view's element list and per-view collapse state."
ears_type: "event-driven"
rationale: "Views must never reference elements that no longer exist. Evidence: packages/common/src/model.ts:192-204; packages/ui/src/store/diagramStore.ts:1637; manual#views"
trigger: "an element is removed from the model"
---
