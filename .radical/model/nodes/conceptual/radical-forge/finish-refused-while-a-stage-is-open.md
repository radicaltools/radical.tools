---
id: "806d19ee-3b2d-4963-8a9d-3ae4a59a4582"
type: "scenario"
label: "Finish refused while a stage is open"
given: "an agent's Forge run whose Requirements stage is completed and whose Domain model stage is generated, with a proposed refinement waiting"
then: "the first call is refused naming the proposal and the second naming the open stage, the run staying active; the third finishes the run, with no stage generating or asking; the writes after it pass, and the new stage puts the run back to active"
when: "the agent calls forge_finish, declines the proposal and calls it again, completes the stage and calls it again, then adds, renames and deletes elements and generates the Fitness functions stage"
---
