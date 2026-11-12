# Radical folder MCP server

This local stdio MCP server lets Codex read and edit one Radical **Markdown model folder**. Point it at a folder containing `radical.md`, `nodes/**/*.md` and the JSON sidecars, or at an empty or missing folder, which becomes a new model. Studio's browser folder watcher reloads outside edits on its normal poll, so changes appear on the open canvas without a separate browser connection.

## Install and connect

Use Node.js 20.11 or newer. The quickest way to connect an agent is the CLI's guided setup, which writes the entry below into each agent's configuration and checks that the server answers:

```sh
npx @radicaltools/cli setup /absolute/path/to/my-model
```

To do it by hand, run the published server without cloning this repository:

```sh
npx -y @radicaltools/mcp --folder /absolute/path/to/my-model
```

For reproducible setups, pin a version, for example `@radicaltools/mcp@0.2.0`.
To connect a coding agent, use `npx` as the command, with
`["-y", "@radicaltools/mcp@0.2.0", "--folder", "/absolute/path/to/my-model"]`
as its arguments. On Windows, use `npx.cmd` as the command and an absolute Windows
folder path. The server waits for MCP messages on stdin and prints no banner to stdout.

## Build from source

From the repository root:

```sh
npm install
npm run build -w @radicaltools/mcp
node apps/mcp/dist/index.js --folder /absolute/path/to/my-model
```

The last command waits for MCP messages on stdin; it prints no banner to stdout. `--folder` may be relative to the directory the server starts in. A missing or empty folder (dot files such as `.git` don't count) becomes a new, empty model; `--metamodel radical` or `c4` picks its metamodel (default `radical`, the Radical metamodel Studio starts new models with). A folder with other files and no `radical.md` is refused. To connect Codex, run the following with absolute paths (or add the equivalent `command` and `args` in [Codex's MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)):

```sh
codex mcp add radical-folder -- node /absolute/path/to/radical.tools/apps/mcp/dist/index.js --folder /absolute/path/to/my-model
codex mcp list
```

Claude Code takes the same command (`claude mcp add radical-folder -- node … --folder …`). For Claude Desktop, add it under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json`, with an absolute path to `node`, because the app does not see your shell's `PATH`.

Launch Studio with `npm run dev:web` from the repository root, open it in Chromium, and open the **same OS folder** via the Models dialog. The browser asks for File System Access permission. The MCP server cannot access a browser-only OPFS folder. Ask the client to use `get_model_summary` first, then `search_model` or the node/relation tools.

## Tool and file behavior

The server binds to one folder at launch, then reads it afresh for every tool call. Its tools are the shared AI tool catalogue from `@radical/common/ai/tools`, the one Studio's AI chat and Radical Forge use, minus the canvas-only `set_active_view` and `focus_node` and the destructive `reset_diagram`. It provides:

- `get_model_summary` (counts, views, sequences, milestones, presentations, the modelling rules Studio's chat and Forge follow, and the metamodel in brief; `types` gives named types in full) and `search_model` (a small query language, including `LIST SEQUENCES` and `GET SEQUENCE`; lists and traversals answer in brief, `GET NODE` and a trailing `FULL` give everything);
- the `forge_*` tools: a Radical Forge run with the agent's model, ending with a Review stage over the whole model, which the server's instructions tell the agent to start only when the user asks for it (otherwise it keeps the model current as it works). `forge_skip_stage` leaves out stages not begun, with the reason: the later stages run without them, and `forge_finish` and Studio name them. Each stage may fill gaps in earlier stages, but only by asking: `forge_propose_refinement` checks a proposal and returns exactly what it would write, for the agent to show the user, and `forge_answer_refinement` writes it only if the user accepts (while a stage is open the server refuses direct writes to earlier stages, and every write while a proposal waits for its answer). `forge_complete_stage` lists what the stage refined, with the gaps the completeness rules still find. In a folder with no base from git, `forge_start` saves the model as it was before the run to `.state/base.json`, so Studio's Changes on branch shows the run. After every step the server writes where the run stands to `.state/forge-run.json` (next to the selection, also out of git), and marks it closed when the client goes away, so Studio open on the folder can show it on its Forge button;
- An Access file (.mdb, .accdb) a unit uses is read for its tables, columns and relations (with `mdb-reader`, a dependency of this package); the CLI reads none.
- A VB6 application's forms are screens of the run (`assay_facts` kind `screens`): a plan's mockups of them get a wireframe drawn from the form and `navigates-to` where its code opens another form. `assay_explore_act` takes `expect` (a text the screen shows; the path's test asserts it). A requirement may name the `processes` that meet it. A transition's evidence is marked `sets` or `quoted` in `run.json`, and a test that asserts nothing rests no scenario.
- `assay_apply` also takes `entities`, `processes` and `stateMachines`: entities written observed on the table facts they are (columns and foreign keys from SQL and ORM classes), joined only where a foreign key states it and realised by every element whose code names their table; processes and state machines written directly as inferred, each step and transition on the entry points (routes, VB6 forms and menus, jobs, handlers), paths, status values or code it rests on. A requirement's scenario may rest on the code it is drawn from (`citations`); accepted, a pending test of it is written where the unit that builds its element has a test framework, and bound in `.radical/radical.json`.
- After every `assay_*` call the server writes where the Assay run stands to `.state/assay-run.json` (the repositories read, each stage from C4 to Scenarios with its plans written and refused, the proposals waiting and answered), the stage told from the calls: a plan is of the latest stage its contents name, and a stage the run moves past with no plan is skipped. Studio open on the central model shows it on an Assay button beside the Forge button; the run is marked closed when the client goes away.
- `assay_search`: the lines of a run's repository or source that hold a text or match a regular expression, with their files and lines, to find what to read with `assay_read`.
- `assay_explore` and `assay_explore_act`: Radical Assay's Explore stage. The server opens a web application running on this machine in a browser it drives (the user's Chrome, else Playwright's Chromium: `npx playwright install chromium`; `RADICAL_ASSAY_BROWSER` picks one) and records the agent's actions as named paths, each screen with its controls and a screenshot in `.radical/assay/explore/`. Other hosts and controls that pay or delete an account are refused. A plan's `mockups` and a scenario's `paths` use them; an accepted path becomes a Playwright test in the application repository's `e2e/assay/`.
- the `assay_*` tools: a Radical Assay run, finding the model in existing code, with this folder as the central model. `assay_start` reads the facts of the code in the directories given (a directory holding repositories stands for each; a folder of code with no `.git`, or a `.zip` file of code, unpacked without its `.git` folders, is one too; a folder of code is left as it was, its facts kept in `.radical/assay/facts/`), each with its file and line, writes them to each repository's `.radical/assay/facts.json`, links their units and answers in brief (at most about 20 KB: the counts, each repository's first units, services and databases, the links counted by kind); `assay_procedure` gives the steps, stage by stage; `assay_facts` lists the facts and links a page at a time (at most 200 and about 20 KB, with where the next starts). `assay_apply` takes a plan of elements and relations, each citing the facts it rests on and marked observed or inferred: it refuses the whole plan, naming every problem, when something cites no fact or a fact the run lacks, an observed claim cites nothing that states it, or the metamodel forbids it; otherwise it writes it, maps the elements built from units in each code repository's `.radical/radical.json` (with a `"model"` entry naming the central model) and keeps the evidence in `.radical/assay/run.json`, not in the model. For a repository Assay reads no units of (VB6, COBOL, Delphi, …), an inferred item may rest on code the agent quotes instead (`citations`: repository, file, lines and the text, which the server checks is in those lines, spacing aside), and an element names the folders it is built in (`paths`); only facts back an observed claim. The plan's requirements, each with the scenarios that verify it from the tests, come back as proposals; `assay_answer` writes one only when the user accepts it (derived from a need *Found in the code*, its tests bound in `.radical/radical.json`), and `assay_finish` says what the run wrote. Documentation is a source of hypotheses: `assay_start`'s `sources` and `assay_add_sources` take folders, files, `.zip` files and public links (no credentials: a link that asks for a login is refused, to be exported by hand; links to loopback, link-local or private addresses are refused unless the server runs with `RADICAL_ASSAY_PRIVATE_LINKS=1`), kept as text in `.radical/assay/sources/` (HTML as Markdown, a PDF's text) and listed as document facts with their headings, as each repository's README, docs and ADR records are; `assay_read` returns a file's lines of the run, numbered, or lists a folder's files. A requirement from documents that no code builds names no element and is written unsatisfied; `assay_answer` can name the need a requirement derives from (`changes.need`). A plan's `needs` and `decisions` drawn from documents, and requirements with no scenarios that cite them, come back as proposals too; a document never backs an observed claim. The `assay` prompt starts a run;
- `get_issues`: every rule the model breaks now, as the Validation list in Studio's metamodel editor shows it. On a large model the open concerns run long: `concerns: "brief"` lists each in one line, `concept` gives one in full, `concerns: "none"` leaves them out. A write is refused when it brings in a new error; the warnings it brings in (a state machine without an initial state, a reference to no node, …) come back with its result, since a model is often incomplete while it is being built;
- `get_selection`: what is selected on Studio's canvas for this folder (the view on screen, each selected node in full, selected relations), so you can say "fix the selected mockup" instead of naming it. Studio writes it to `.state/selection.json` in the model folder whenever the selection or the view changes, and clears it when you switch to another model; `.state/` carries its own `.gitignore`, and the file is not part of the model, so writing it never conflicts with model edits;
- `get_changes`: what changed in the model since its version in git, for an agent asked to implement a change made in the model. It lists the elements and relations added, removed and changed (uncommitted edits included), each changed field with its old and new value, and each element with its place and its relations, such as the component that satisfies a requirement and the scenarios that verify it. Views, positions, sizes and folding are left out. `since` names the branch, tag or commit to compare with; by default it is the merge base with the default branch (`origin/main`), so every model change on the branch counts. `radical diff` prints the same list. Without `since` it also saves that base to `.state/base.json`, for Studio to show the same changes (Changes on branch);
- `get_verification` and `set_verification`: which tests check the model's scenarios and fitness functions, in the repository's `.radical/radical.json` ("verifies"; the model names no test). `get_verification` with an `id` lists the tests bound to it; without one, every entry and the scenarios this repository must verify that have nothing checking them. `set_verification` replaces a scenario's or fitness function's tests, or takes it out with `remove: true`, as `radical verify` does; call it for each test you write. It changes no model file;
- `get_implementation` and `set_implementation`: where the repository builds the model's elements, in its `.radical/radical.json` (folders from the repository's root). `get_implementation` with an `id` gives the element's folders, its own or its nearest mapped parent's; without one, every entry and the C4 elements built nowhere the file says. `set_implementation` replaces an element's folders, or takes it out with `remove: true`, as `radical implement` does; it changes no model file. The repository's sensors, `radical check` and Studio's element card read the same file;
- `add_`, `update_` and `delete_` tools for nodes and relations, and `move_node` to change a node's parent (the node keeps its canvas position where it lies inside the new parent and clear of its new siblings, else it is placed beside them and what lies round the grown parent makes room; it enforces the metamodel's `allowedParents`). A reference property (a transition's `event` and `raises`) takes node ids or tempIds from the same connection and refuses a node of the wrong type;
- `create_view`, `update_view` (name, folder in the list of views, line style, kind, linked sequence, hidden relations, elements shown open or folded, filter chain, or `viewpoint`: one of the metamodel's viewpoints, whose kind and chain the view then follows, with `subject` the element it draws for a viewpoint that draws one, such as a state machine or a system's containers; `null` keeps them for the view alone), `set_view_nodes`, `order_views` (the order of views, and so of their folders) and `delete_view`;
- `create_sequence`, `update_sequence` and `delete_sequence`: ordered relation flows that a `dynamic` view plays;
- `create_presentation`, `update_presentation` and `delete_presentation`: slides over views, which Studio frames to fit the whole view or the slide's `focus` elements (several slides can zoom onto parts of one view), showing the current model or a `milestone`;
- `list_milestones`, `create_milestone`, `update_milestone`, `delete_milestone` and `compare_milestones`: named copies of the model at phases of the system ("As-is", "Target 2027"). `create_milestone` saves the current model as the latest one and `compare_milestones` lists what changed; no tool loads a milestone over the current model, which stays in Studio's timeline;
- `upsert_viewpoint` and `delete_viewpoint`: viewpoints of the metamodel, a view type and a filter chain under a name (given as `pipeline` or copied from a view with `fromViewId`), in a `group` such as `C4` or `Requirements`, and with `subjectTypes` drawing one element of those types per view. Studio's New view offers them, and the views of a type follow its changes; a deleted type leaves its views their kind and chain. They do not copy a built-in metamodel: a model keeps its own viewpoints when Studio swaps the preset in;
- `upsert_node_type`, `delete_node_type`, `upsert_relation_type` and `delete_relation_type`. A type takes a `description` (what it is; the wiki view shows it), a relation type also `forwardLabel` and `inverseLabel` (how it reads in a sentence from its source and from its target). A built-in metamodel is copied to a `…-custom` id on the first edit, because Studio replaces built-in metamodels with their preset on load. A type cannot be deleted while elements or relations of it remain, in the model or in a milestone, or while a viewpoint or a view's filter chain names it. After a metamodel change (from these tools or from Studio) the server re-advertises the node and relation tool schemas;
- `smart_layout`, for All elements or one static view (`viewId`), which then gets its own saved positions; a dynamic view plays its sequence and, like a table or a wiki, has no canvas layout;
- `align_nodes` (a row or a column, with `keepOrder` to keep the listed order), `grid_nodes` (`columns` columns, filled row by row) and `remove_alignment`, for All elements or one static view (`viewId`). Studio and `smart_layout` keep these rules in every later layout.

 These use Studio's shared schemas and model rules. Besides counts, `get_model_summary` returns the metamodel context message the other tool descriptions refer to, in brief: each node type in one line with where it may go and its property keys (enum options when short, the type a reference points at), each relation type with its pairs, and the viewpoints by name. `get_model_summary` with `types: ["requirement", "constrains"]` returns only those types' whole definitions. `search_model` answers lists and traversals in brief, one sentence an element (a requirement's EARS sentence, an ADR's decision) and each relation once; `GET NODE <id>` gives one element whole, `FULL` at the end of a query every field of every row. In the Radical benchmark these two answers had filled a third of an agent's context. The server's MCP instructions tell clients to call it first. New nodes are placed inside their parent below its header (root nodes to the right of the existing ones), and every parent a change adds to, moves or removes from is refitted to its children. `smart_layout` runs Studio's Smart Layout over the whole model (the **All elements** arrangement) and saves the result; views with their own saved positions keep them. On a large model it can take minutes: a client that sends a progress token gets a progress notification per step, and a cancelled call (or a client that disconnects) stops at the next step without writing anything. The server exits when the client closes its end. Writes also update `defaultPositions`, which Studio restores when you switch back to **All elements**. `add_node` returns the persisted real ID, and a `tempId` can be used in later calls on the same MCP connection. Newly added nodes appear in Studio's **All elements** view until a view lists them. The server refreshes its model data per call.

Writes preserve unrelated files and the existing `radical.md` text. A tool reports success only after the changed model files are written. After such a reload Studio highlights what changed for about five seconds (new and changed elements badged, removed ones as ghosts; layout alone shows nothing), so you can follow an agent at work.

### Working alongside Studio

You can keep editing in Studio while an agent writes the same folder. Neither side overwrites the other:

- **Merged, not refused.** If a file changed between a call's read and its write (Studio saved, you edited a file, git pulled), the server merges its change with that edit, element by element and field by field, and says so in the result (`Merged with edits made in the folder while the call ran …`). Where both changed the same value, the folder's is kept and the result names it, so the agent can check it with `search_model`. Studio merges its own saves the same way. A change only to positions or sizes merges silently. A file that no longer reads as a model (git conflict markers, a half-written file) is not merged over: the call writes nothing and names the file.
- **Two writers at once.** Two servers on one folder (Claude Desktop and Claude Code), or a server and the desktop app, write it one at a time: each takes the folder's turn in `.state/write.lock` for its check and its write, so the second finds the first one's change and merges with it. A turn left by a process that is gone, or held for 15 seconds, is taken over. Studio in a browser does not take turns; it merges as above.
- **Taking turns.** After each write the server marks the folder as being written by an agent in `.state/agent-activity.json` (out of git, like the selection) for 15 seconds. Meanwhile Studio holds its saves: it says so once, takes in each change of the agent as it reloads, keeping your edits on top, and saves them when the agent pauses.

Single `.radical` JSON files, loading a milestone over the current model (the milestone tools save, list, rename, delete and compare them), commands that drive Studio's canvas, and remote HTTP MCP are not supported by this server.

Run `npm run test -w @radicaltools/mcp` to build and exercise a real stdio connection and temporary disk folder.

## Publishing (maintainers)

The package is published under the `radicaltools` npm organization. The earlier
`@radical.tools/mcp` releases have a separate npm identity; their versions and
Trusted Publishing settings do not transfer to `@radicaltools/mcp`. Switching
clients requires replacing the package name in their `npx` configuration.

The package contains only its ESM build, the Hub catalogue, this README, its
manifest and the MIT license. The four private `@radical/*` workspaces are build
dependencies bundled by tsup; users install only the MCP SDK and ELK.js as runtime
dependencies. `prepack` builds from source, clears old build output and copies
the catalogue and root license. The MCP handshake, `get_model_summary` and
`radical-mcp --version` report the product version, with the commit it was built
from unless the build is the release tagged `v<version>` (`0.3.0+1a2b3c4`).

Before the first release, from the repository root:

```sh
npm ci --ignore-scripts
npm run check:workspaces
npm run typecheck
npm test
npm run test:package -w ./apps/mcp -- --out-dir ../../release
```

The last command builds and packs the package, installs it with production
dependencies in a temporary project outside this repository, then starts its
installed executable over stdio. It checks the handshake, disk writes and reload,
Smart Layout's lazy-loaded chunks, and Forge's bundled Hub catalogue. Only after
those checks pass does it copy the verified tarball into `release/`. The same
check runs on Linux and Windows with Node 20 and 24 in CI.

Log in to npm with the account that owns the `radicaltools` organization and
publish the verified first-release archive, completing npm's 2FA challenge:

```sh
npm login --auth-type=web
npm whoami
npm publish ./release/radicaltools-mcp-0.2.0.tgz --access public
```

Do this after the pull request is merged, from the reviewed main commit. A name
and version can only be published once. The MCP server shares one product
version with the CLI, the Desktop app and the VS Code extension: set it for all
of them with `npm run release` (see *Releasing* in the root README), never in
this workspace alone.

### GitHub Actions with Trusted Publishing

After `@radicaltools/mcp` exists, open its npm **Settings → Trusted publishing**
and add GitHub Actions with these values:

| Field | Value |
| --- | --- |
| Organization or user | `radicaltools` |
| Repository | `radical.tools` |
| Workflow filename | `npm-publish.yml` |
| Environment name | Leave empty |
| Allowed actions | Enable direct publishing with `npm publish` |

The shared workflow publishes either CLI or MCP. If the existing trusted
publisher points at `mcp-publish.yml`, replace it with one using
`npm-publish.yml` after merging this change. Trusted publishers are configured
per npm package, even though both packages use the same workflow.

No npm token or GitHub secret is needed. npm requires Node 22.14+ and npm 11.5.1+
for Trusted Publishing; the workflow uses Node 24 and npm 11, and gives only the
publish job `id-token: write`. A new trusted publisher must complete its first
successful publish within two days, so configure it when the next version is
ready. See [npm's Trusted Publishing instructions](https://docs.npmjs.com/trusted-publishers/).

If npm shows **Pending validation**, publish a new version through this workflow
before the deadline shown in npm. A dry run or a local `npm publish` does not
validate the OIDC connection. The workflow needs direct `npm publish` permission;
`npm stage publish` alone is insufficient, and managing dist-tags is not needed.

A release tag `v<version>` (see *Releasing* in the root README) starts the
workflow for the CLI and the MCP server together: it checks that the tagged
commit is on `main` and that the four released packages carry the tag's
version, type-checks and tests the monorepo, verifies the installable tarball,
and publishes that same archive with provenance, on the dist-tag `next` for a
pre-release. A version npm already has is skipped, so a rerun publishes what
is left.

To check the package without a release, use **Actions → Publish to npm → Run
workflow**, select `main`, choose **package: mcp**, and leave **dry-run**
enabled. With **dry-run** disabled it publishes, but only from `main`.
