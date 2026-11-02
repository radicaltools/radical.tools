---
id: "16ec2a16-b567-4005-89fc-71615e5047ee"
type: "scenario"
label: "Four AI providers"
given: "Studio's AI settings with nothing stored yet"
metrics: |
  test(apps/studio/tests/aiProviders.test.ts › AI providers › registry exposes all four adapters) passed
  test(apps/studio/tests/aiSettings.test.ts › aiSettings › returns defaults when nothing is persisted) passed
  test(apps/studio/tests/aiSettings.test.ts › aiSettings › round-trips via save/load) passed
  test(apps/studio/tests/aiSettings.test.ts › aiSettings › falls back to defaults on bogus active provider) passed
then: "the registry holds the Anthropic, Gemini, Ollama and OpenAI adapters; the settings keep one active provider and each provider's own model, base URL and key; an unknown active provider falls back to OpenAI"
when: "the provider registry is listed and settings for one provider are saved and loaded again"
---
