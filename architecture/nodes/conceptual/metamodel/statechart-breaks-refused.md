---
id: "c616e9f4-d974-4866-a998-9e6989b445aa"
type: "scenario"
label: "Statechart breaks refused"
given: "a state machine with an initial pseudostate, states, a final state and a parallel state, the lifecycle of an entity"
tests: |
  packages/common/tests/stateMachine.test.ts › an edit the statechart rules flag is refused
  packages/ui/tests/nodeWizard.test.ts › requestCreateNode › refuses the node when the rules refuse one of its links
  apps/e2e/tests/studio/state-machines.spec.ts › a transition from a final state is refused, with the reason
then: "each edit is refused with the reason and the model stays as it was; the pseudostate with no kind becomes a choice"
when: "the user or an agent draws a transition out of the final state, into the initial pseudostate, a second one out of it or out of the machine, moves a transition's end onto the final state, makes a state with outgoing transitions final, adds an initial pseudostate in the parallel state or beside the existing one, adds a pseudostate with no kind, makes a second machine for the entity, and creates a node whose wizard links the rules refuse"
---
