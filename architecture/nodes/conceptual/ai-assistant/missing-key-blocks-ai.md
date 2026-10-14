---
id: "16bc8b99-b4a1-4ae3-ab8d-e72d01ae3475"
type: "requirement"
label: "Missing key blocks AI"
action: "Studio shall send no AI request and shall tell the user to set an API key for that provider first, offering a way to the AI providers dialog."
ears_type: "unwanted-behaviour"
rationale: "A request without a key can only fail; pointing to the fix is the useful outcome. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx:70-83,109-113; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:226-236,660-665; apps/studio/src/renderer/src/ai/providers/claude.ts:123; apps/studio/src/renderer/src/ai/providers/openai.ts:92; apps/studio/src/renderer/src/ai/providers/gemini.ts:100; manual#ai"
unwanted_condition: "the active provider is OpenAI, Anthropic or Gemini and no API key is set"
---
