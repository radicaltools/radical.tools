---
id: "1533ed1d-a405-4cb8-bc92-491e292d0cc8"
type: "requirement"
label: "Deleted elements leave views"
action: "The system shall remove the element and its descendants from every view's element list and per-view collapse state of the live model, a milestone that holds them keeping its own list (Milestones share the views' layout)."
ears_type: "event-driven"
rationale: "Views must never reference elements that no longer exist; a milestone that holds the element still shows it (F-0053, 2026-10-23), and Unwrap cleans up as a delete does (F-0054). Evidence: packages/common/src/model.ts:192-204; packages/ui/src/store/diagramStore.ts:1637; manual#views"
trigger: "an element is removed from the model (deleted or unwrapped)"
---
