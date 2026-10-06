---
id: "c0eb2ce8-68fc-4204-b15a-cabd919ce575"
type: "requirement"
label: "Answers from model queries"
action: "The AI assistant shall be able to query the live model with the built-in query language (LIST NODES/RELATIONS/VIEWS WHERE, GET NEIGHBORS/DEPENDENCIES/DEPENDENTS, STATS MODEL) before it answers or acts."
ears_type: "ubiquitous"
rationale: "Exact query results instead of guesses make answers about the model trustworthy. Evidence: packages/common/src/ai/queryLanguage.ts:3-50; packages/common/src/ai/tools/modelTools.ts:8-17,38-52; apps/studio/src/renderer/src/ai/systemPrompt.ts:13; manual#ai"
---
