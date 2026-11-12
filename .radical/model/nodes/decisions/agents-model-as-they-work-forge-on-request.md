---
id: "12a21c0f-dd2e-465d-adc5-3b3373bb079e"
type: "adr"
label: "Agents model as they work; Forge on request"
alternatives: "Forge for every new system and modelling as you work for changes (the benchmark's first step was cheaper and no worse without Forge). A skip parameter on forge_generate (one stage a call, a generate that does not generate). Skipping in Studio's wizard too (left for later)."
consequences: "An agent's first session costs what its work needs, not nine stages. A user who wants the full walk-through asks for Forge and still gets it; an agent in Forge sizes it to the system. Studio's own Forge wizard is unchanged for now."
context: "The MCP server told every agent to start a new system with forge_start, and Forge ran its nine stages strictly in order, three calls each, with no way to leave one out. In the benchmark this cost three times as much for no better model or code, and the agent's window filled with stage prompts it did not need."
date: "2026-11-12"
decision: "By default an agent keeps the model current as it works: it writes what it learns and decides when it learns and decides it (a need, the requirements derived from it, the elements that satisfy them, an ADR for each decision, a scenario for a requirement it tests), before the code. It runs Radical Forge only when the user asks for it. In a Forge run, forge_skip_stage leaves out any stages not begun, with the reason; later stages run without them, and forge_finish and Studio's view of the run name them with the reason."
status: "accepted"
---
