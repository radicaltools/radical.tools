---
id: "fa69ea13-6b88-4e8e-8d1f-5364fc701c69"
type: "requirement"
label: "Four AI providers"
action: "Studio shall offer Ollama, OpenAI, Anthropic Claude and Google Gemini as AI providers, with exactly one of them active, each with its own model, base URL and API key settings."
ears_type: "ubiquitous"
rationale: "Users choose the model vendor, or a local model, instead of being tied to one. Evidence: apps/studio/src/renderer/src/ai/registry.ts:9-14; apps/studio/src/renderer/src/ai/settings.ts:10-34; apps/studio/src/renderer/src/components/AISettingsModal.tsx:167-291; manual#ai"
---
