---
id: "d6a339c2-2253-4eee-a91e-8e234d7d8788"
type: "scenario"
label: "Custom type usable by AI"
given: "a metamodel with a custom element type"
tests: "apps/studio/tests/aiRunner.test.ts › runAIPrompt — tool groups and metamodel changes › rebuilds the tool schemas after a metamodel tool adds a type"
then: "the tool schemas offered to the model list that type and the next round can create it"
when: "an AI run starts, or a metamodel tool adds a type during the run"
---
