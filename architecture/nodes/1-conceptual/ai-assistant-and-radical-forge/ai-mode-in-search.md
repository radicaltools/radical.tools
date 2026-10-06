---
id: "dc66a61d-5b0c-4f68-b605-5b51cca595eb"
type: "requirement"
label: "AI mode in search"
action: "Quick Search shall switch to AI mode, or with Cmd/Ctrl+Enter send the typed text straight to the AI assistant."
ears_type: "event-driven"
rationale: "The assistant lives where users already search, without a separate panel. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx:446-467,518-530; manual#ai"
trigger: "AI is enabled and configured, and the user presses Tab in the empty Quick Search box, clicks the ✨ button, or presses Cmd/Ctrl+Enter"
---
