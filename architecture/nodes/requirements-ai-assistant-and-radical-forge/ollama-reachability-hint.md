---
id: "ae62c2b3-448f-45c4-b081-9170410fec37"
type: "requirement"
label: "Ollama reachability hint"
action: "Studio shall report that Ollama cannot be reached and show the OLLAMA_ORIGINS setting needed to allow this page's origin."
ears_type: "unwanted-behaviour"
rationale: "A browser page calling a local Ollama is usually blocked by CORS, and the fix is not obvious. Evidence: apps/studio/src/renderer/src/ai/providers/ollama.ts:1-3,108-125; apps/studio/src/renderer/src/components/AISettingsModal.tsx:244-258; manual#ai"
unwanted_condition: "the browser cannot reach the configured Ollama server"
---
