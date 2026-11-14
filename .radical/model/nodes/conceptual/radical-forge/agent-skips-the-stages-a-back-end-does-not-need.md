---
id: "1480bdf5-1800-4854-8000-8ad63200a29c"
type: "scenario"
label: "Agent skips the stages a back end does not need"
given: "an agent's Forge run on a back end, with the Requirements stage done"
then: "the five stages are skipped with the reason in the run's status and in forge_finish, c4 is clarified without a refusal, and the answer named c4 as the next stage; skipping requirements again (done) or a stage that is open is refused naming it; clarifying a skipped stage runs it"
when: "the agent calls forge_skip_stage with domain, fitness, states, processes and mockups and the reason \"a small back end without screens\", then forge_clarify for c4, then forge_finish"
---
