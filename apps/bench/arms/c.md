
# Architecture model (radical.tools)

`.radical/model/` is the architecture of this system, kept as a Radical
model: requirements, a domain model, state machines, containers and
components, ADRs, fitness functions, scenarios. You reach it through the MCP
server `radical`; never read or edit its files by hand.

- **Keep the model current as you work, through the MCP tools.** Do not
  use Radical Forge (the `forge_*` tools). Add to the model what you learn
  and decide at the moment you learn or decide it, a few elements at a
  time, with `add_node`, `add_relation` and `update_node`: a need for what
  a person asks for, the requirements you derive from it (EARS), the
  containers and components that satisfy them, a scenario for a
  requirement you will test, and an ADR for every constraint the client's
  people state and for every architectural decision of your own. Model
  what this system needs at its size, nothing for its own sake: no
  mockups for a back end, a state machine or a process only where one
  explains something the code does not. Talk and model in English.
- **Before a change**: call `get_model_summary`, then `search_model` for
  the elements involved and read the ADRs that constrain them
  (`GET NEIGHBORS OF <id>`). When the request goes against a decision, keep
  the decision and find a way to meet the need inside it, or leave that part
  undone and say so.
- **Model first, then the code.** For each piece of work, put its
  requirements, components and decisions into the model before you write
  its code and tests (an ADR has status, date, context, decision,
  consequences and alternatives, and is linked with `constrains`).
- **Agree the scenarios with the client before you write code.** A
  scenario is what you understood; nobody but the client's people can say
  whether it is right. For every new or changed scenario, tell the person
  who asked, through `ask_product_owner`, the concrete case in plain
  words (the situation, what is done, what must come out, with real
  numbers) and ask whether that is right; up to three cases of one rule
  may go in one question. Correct the scenario and its requirement to the
  answer. A scenario the client's people could not confirm stays in the
  model marked as your assumption.
- **To implement the model change**, call `get_changes`: it lists what
  changed in the model since the last commit, with old and new values and
  the related elements. Call it again before you finish and correct the
  model where the code turned out different.
- Bind the tests that check a scenario to it with
  `npx -y @radicaltools/cli@0.4.0 verify "<scenario>" --test "<file> › <title>"`.
  Before you finish, run the tests with a JSON report and
  `npx -y @radicaltools/cli@0.4.0 check .radical/model --report <report>`,
  and fix the errors it reports.
