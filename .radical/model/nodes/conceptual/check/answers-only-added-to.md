---
id: "06516616-7c8d-48a6-a951-b1e2e23fecc2"
type: "requirement"
label: "Answers only added to"
action: "it shall report an error on the need naming the answer, and say to restore it and mark it (superseded) if a later answer replaces it"
ears_type: "event-driven"
rationale: "The person's words reach the model through the agent, which could otherwise correct them to fit its requirement unseen. A replaced answer stays as it was said, marked, and the later one says what holds now."
trigger: "radical check, with the model at its git base (the merge base with the default branch), or the Inspector, with the branch's base, checks a need that held an answer of a person at the base which it no longer holds word for word (a mark (superseded) added aside)"
---
