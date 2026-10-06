---
id: "04279c33-97b6-44a4-95a5-68b1f1623115"
type: "adr"
label: "Bring your own AI key"
alternatives: "A proxy service with a project-owned key."
consequences: "No AI cost for the project and no model data on its servers. Each user configures a provider before using the AI features."
context: "The AI assistant and Radical Forge need an LLM, but the project runs no backend, and users care where their architecture is sent."
decision: "Studio calls OpenAI, Anthropic, Gemini or a local Ollama model directly with the key the user enters. Nothing is proxied."
status: "accepted"
---
