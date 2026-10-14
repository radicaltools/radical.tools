---
id: "43e82eec-94cf-4c90-951b-36d6132b97eb"
type: "fitness-fn"
label: "Direct AI provider calls"
category: "structural"
tests: |
  apps/studio/tests/aiProviders.test.ts › AI providers
  apps/studio/tests/aiSettings.test.ts › aiReady
threshold: "All tests pass: every adapter calls its vendor endpoint (api.openai.com, api.anthropic.com, Gemini generateContent, the configured Ollama host) with the user's key; a cloud provider is never ready without a key"
---

apps/studio/tests/aiProviders.test.ts checks that each of the four adapters (OpenAI, Anthropic, Gemini, Ollama) sends its request straight to the vendor URL with the key the user entered (Bearer, x-api-key, ?key=), with no proxy in between; apps/studio/tests/aiSettings.test.ts › aiReady checks that a cloud provider needs a key and Ollama none.
