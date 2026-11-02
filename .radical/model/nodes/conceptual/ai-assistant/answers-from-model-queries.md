---
id: "c0eb2ce8-68fc-4204-b15a-cabd919ce575"
type: "requirement"
label: "Answers from model queries"
action: "The AI assistant and MCP agents shall be able to query the live model with search_model's query language (LIST NODES/RELATIONS/VIEWS WHERE with =, != and ~ under AND, OR, NOT, LIST SEQUENCES, LIST TECHNOLOGIES, GET NODE/VIEW/SEQUENCE, GET CHILDREN OF, GET NEIGHBORS/DEPENDENCIES/DEPENDENTS OF with an optional depth, STATS MODEL) before they answer or act."
ears_type: "ubiquitous"
rationale: "Exact query results instead of guesses make answers about the model trustworthy. Evidence: packages/common/src/ai/queryLanguage.ts:3-50; packages/common/src/ai/tools/modelTools.ts:8-17,38-52; packages/common/src/ai/systemPrompt.ts:28-30; manual#ai"
---
