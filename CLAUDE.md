# radical.tools

## Architecture model

`architecture/` is the architecture of radical.tools itself, kept as a Radical
Markdown-folder model (Radical metamodel): containers, shared packages,
ADRs, fitness functions, needs and requirements, a domain model and its state
machines. It is committed with the code, and CI checks it: the "Architecture
model" job runs `radical check architecture` against the run's test reports,
with the rules, baselines and goals in `architecture/check.json`, and fails on an
error. Claude Code reaches it through the project MCP server
`radical-architecture` (`.mcp.json`), which needs
`npm run build -w @radicaltools/mcp` once after cloning and after MCP changes.
Studio can open the same folder. `npm run hooks` (once after cloning, and again
after CLI changes) adds git hooks that save `architecture/.radical/base.json`
after every checkout, commit, pull and rebase, so Studio's Changes on branch and the
Inspector's Changes tab show the branch's model changes.

- **Before a structural change** (a new or removed app or package, a new
  dependency between workspaces, a new external service, or going against a
  decision): call `get_model_summary`, then `search_model` for the elements
  involved and read the ADRs that constrain them (`GET NEIGHBORS OF <id>`).
- **Model first, then the code.** A change starts in the model, on the
  branch that will implement it: update the model through the MCP tools
  rather than by editing the files (add or change requirements, scenarios
  with the tests they will name, components, relations; record a new
  decision as an ADR with status, date, context, decision, consequences and
  alternatives, linked with `constrains`, and an automated check as a fitness
  function that `implements` it; then run `smart_layout` on the views you
  changed). Only then write the code. The model change and its
  implementation go in the same branch and pull request: never push or merge
  a model change to `main` ahead of its code.
- **To implement the model change**, start with `get_changes` (or
  `radical diff architecture`): it lists what changed in the model since the
  branch left `main`, uncommitted and unpushed edits included, with old and
  new values and the related elements. If the model change already reached
  `main`, pass `since` with the commit before it. Call it again before you
  report the work as done, and correct the model where the code turned out
  different.
- A change that adds behaviour adds its requirement (EARS, derived from a need,
  satisfied by the component that implements it), and a scenario naming the
  tests that check it. A change that alters behaviour updates the texts that
  describe it. On `main` the model describes the current implementation.
- Before pushing, run what CI runs: `npm run test:reports` (plus `npm run e2e`
  for the e2e tests; both write to `reports/`), then
  `npm run check:architecture`. It must report no errors: a failing or missing
  test the model names, a gap above its baseline, or a metric below its goal,
  is one. Never raise a baseline or lower a goal in `check.json` to get past
  it; `--ratchet` lowers baselines.
- Write the model in English.
- When the product gets in the way while doing this (a missing tool, an
  awkward format, a bad layout), add it to `docs/IMPROVEMENTS.md` under
  "Dogfooding".
