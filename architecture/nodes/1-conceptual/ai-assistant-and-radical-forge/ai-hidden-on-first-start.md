---
id: "2d10abc0-692e-4f29-a033-052082ab919d"
type: "scenario"
label: "AI hidden on first start"
gherkin: |
  And the active provider defaults to OpenAI with empty model, base URL and key
  # Covered by: apps/studio/tests/aiSettings.test.ts › aiSettings › returns defaults when nothing is persisted
given: "a browser that has never saved AI settings"
then: "no ✨ AI mode button is shown and AI is reported as disabled in the AI providers dialog"
when: "the user opens Studio and the Quick Search bar"
---
