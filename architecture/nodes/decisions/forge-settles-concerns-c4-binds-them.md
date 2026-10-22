---
id: "9be1c7c9-ff37-4f31-a4a6-e1db78d9c540"
type: "adr"
label: "Forge settles concerns, C4 binds them"
alternatives: |
  1. Ask the questions in the Review stage, after C4: the model has already written its own requirements for the concern, so the pack duplicates them.
  2. Import each part of a pack in its own stage (requirements in Requirements, ADR in Fitness): splits one decision across stages for no gain.
  3. Bind to a placeholder system created early: Forge would make C4 elements before its C4 stage.
  4. Keep keyword matching over the packs: ten packs fit in the clarify prompt whole; a ranking is not needed.
consequences: |
  • The answers shape everything generated after them: no sign-in screens when nobody signs in, no duplicate requirements for a concern a pack covers.
  • The model decides where a decision applies in C4, where it knows which container does the work; the trigger's suggestion is only the fallback.
  • A run stopped before C4 leaves unbound decisions, which radical check reports until they are bound.
  • Concern picking from the brief is the model's: without AI, Forge picks none; the critic still finds the concerns once C4 exists.
context: "With the Hub holding only concern packs, Radical Forge's Hub matching (keyword ranking of 128 concepts, a fitting blueprint first, the model picking up to five per stage as prior art) has nothing left to match. A concern pack needs elements to bind to, and its trigger reads relations between C4 elements, but Forge builds C4 last, after requirements, the domain, fitness functions, scenarios, state machines, processes and mockups. Asked only at the end, the questions come after the model has written its own requirements about the same concern, so the pack would duplicate them."
date: "2026-10-22"
decision: "In the clarify step of the Requirements stage the model picks, from the Hub's concern packs, those the description calls for, in whatever language it is written, and their questions join the stage's questions with their options (defaults chosen). When the answers are confirmed, Forge imports each picked pack whole for its answers, unbound, before the stage is generated, and every later stage is told that those concerns are decided, so it writes no requirement, decision or fitness function of its own for them. The C4 stage gets the imported decisions and links each to the elements it is about (constrains from the ADR and its fitness functions, satisfies to its requirements). After the C4 stage Forge binds every pack decision that still constrains nothing to the elements its trigger suggests (suggestedCover) and says so in the stage's summary. Between import and C4 the pack is unbound, which concern-unbound reports if the run stops there. The same steps run in Studio's Forge and over MCP (@radical/common/ai/forge). Keyword Hub matching, the blueprint suggestion and Hub prior art are removed."
status: "accepted"
---
