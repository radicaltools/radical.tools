# Radical folder MCP server

This local stdio MCP server lets Codex read and edit one Radical **Markdown model folder**. Point it at a folder containing `radical.md`, `nodes/**/*.md` and the JSON sidecars, or at an empty or missing folder, which becomes a new model. Studio's browser folder watcher reloads outside edits on its normal poll, so changes appear on the open canvas without a separate browser connection.

## Install and connect

Use Node.js 20.11 or newer. Run the published server without cloning this repository:

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

- `get_model_summary` (counts, views, sequences, milestones, presentations, the modelling rules Studio's chat and Forge follow, and the metamodel rules) and `search_model` (a small query language, including `LIST SEQUENCES` and `GET SEQUENCE`);
- the `forge_*` tools: a Radical Forge run with the agent's model, ending with a Review stage over the whole model. Each stage may fill gaps in earlier stages, but only by asking: `forge_propose_refinement` checks a proposal and returns exactly what it would write, for the agent to show the user, and `forge_answer_refinement` writes it only if the user accepts (while a stage is open the server refuses direct writes to earlier stages, and every write while a proposal waits for its answer). `forge_complete_stage` lists what the stage refined, with the gaps the completeness rules still find. In a folder with no base from git, `forge_start` saves the model as it was before the run to `.radical/base.json`, so Studio's Changes on branch shows the run. After every step the server writes where the run stands to `.radical/forge-run.json` (next to the selection, also out of git), and marks it closed when the client goes away, so Studio open on the folder can show it on its Forge button;
- `get_issues`: every rule the model breaks now, as the Validation list in Studio's metamodel editor shows it. A write is refused when it brings in a new error; the warnings it brings in (a state machine without an initial state, a reference to no node, …) come back with its result, since a model is often incomplete while it is being built;
- `get_selection`: what is selected on Studio's canvas for this folder (the view on screen, each selected node in full, selected relations), so you can say "fix the selected mockup" instead of naming it. Studio writes it to `.radical/selection.json` in the model folder whenever the selection or the view changes, and clears it when you switch to another model; `.radical/` carries its own `.gitignore`, and the file is not part of the model, so writing it never conflicts with model edits;
- `get_changes`: what changed in the model since its version in git, for an agent asked to implement a change made in the model. It lists the elements and relations added, removed and changed (uncommitted edits included), each changed field with its old and new value, and each element with its place and its relations, such as the component that satisfies a requirement and the scenarios that verify it. Views, positions, sizes and folding are left out. `since` names the branch, tag or commit to compare with; by default it is the merge base with the default branch (`origin/main`), so every model change on the branch counts. `radical diff` prints the same list. Without `since` it also saves that base to `.radical/base.json`, for Studio to show the same changes (Changes on branch);
- `add_`, `update_` and `delete_` tools for nodes and relations, and `move_node` to change a node's parent (the node keeps its canvas position where it lies inside the new parent and clear of its new siblings, else it is placed beside them and what lies round the grown parent makes room; it enforces the metamodel's `allowedParents`). A reference property (a transition's `event` and `raises`) takes node ids or tempIds from the same connection and refuses a node of the wrong type;
- `create_view`, `update_view` (name, folder in the list of views, line style, kind, linked sequence, hidden relations, elements shown open or folded, filter chain, or `viewpoint`: one of the metamodel's viewpoints, whose kind and chain the view then follows, with `subject` the element it draws for a viewpoint that draws one, such as a state machine or a system's containers; `null` keeps them for the view alone), `set_view_nodes`, `order_views` (the order of views, and so of their folders) and `delete_view`;
- `create_sequence`, `update_sequence` and `delete_sequence`: ordered relation flows that a `dynamic` view plays;
- `create_presentation`, `update_presentation` and `delete_presentation`: slides over views, which Studio frames to fit the whole view or the slide's `focus` elements (several slides can zoom onto parts of one view), showing the current model or a `milestone`;
- `list_milestones`, `create_milestone`, `update_milestone`, `delete_milestone` and `compare_milestones`: named copies of the model at phases of the system ("As-is", "Target 2027"). `create_milestone` saves the current model as the latest one and `compare_milestones` lists what changed; no tool loads a milestone over the current model, which stays in Studio's timeline;
- `upsert_viewpoint` and `delete_viewpoint`: viewpoints of the metamodel, a view type and a filter chain under a name (given as `pipeline` or copied from a view with `fromViewId`), in a `group` such as `C4` or `Requirements`, and with `subjectTypes` drawing one element of those types per view. Studio's New view offers them, and the views of a type follow its changes; a deleted type leaves its views their kind and chain. They do not copy a built-in metamodel: a model keeps its own viewpoints when Studio swaps the preset in;
- `upsert_node_type`, `delete_node_type`, `upsert_relation_type` and `delete_relation_type`. A type takes a `description` (what it is; the wiki view shows it), a relation type also `forwardLabel` and `inverseLabel` (how it reads in a sentence from its source and from its target). A built-in metamodel is copied to a `…-custom` id on the first edit, because Studio replaces built-in metamodels with their preset on load. A type cannot be deleted while elements or relations of it remain, in the model or in a milestone, or while a viewpoint or a view's filter chain names it. After a metamodel change (from these tools or from Studio) the server re-advertises the node and relation tool schemas;
- `smart_layout`, for All elements or one static view (`viewId`), which then gets its own saved positions; a dynamic view plays its sequence and, like a table or a wiki, has no canvas layout;
- `align_nodes` (a row or a column, with `keepOrder` to keep the listed order), `grid_nodes` (`columns` columns, filled row by row) and `remove_alignment`, for All elements or one static view (`viewId`). Studio and `smart_layout` keep these rules in every later layout.

 These use Studio's shared schemas and model rules. Besides counts, `get_model_summary` returns the metamodel context message the other tool descriptions refer to: each type's property keys and enum options, allowed parents, cardinality and relation pairs. The server's MCP instructions tell clients to call it first. New nodes are placed inside their parent below its header (root nodes to the right of the existing ones), and every parent a change adds to, moves or removes from is refitted to its children. `smart_layout` runs Studio's Smart Layout over the whole model (the **All elements** arrangement) and saves the result; views with their own saved positions keep them. On a large model it can take minutes: a client that sends a progress token gets a progress notification per step, and a cancelled call (or a client that disconnects) stops at the next step without writing anything. The server exits when the client closes its end. Writes also update `defaultPositions`, which Studio restores when you switch back to **All elements**. `add_node` returns the persisted real ID, and a `tempId` can be used in later calls on the same MCP connection. Newly added nodes appear in Studio's **All elements** view until a view lists them. The server refreshes its model data per call.

Writes preserve unrelated files and the existing `radical.md` text. A tool reports success only after the changed model files are written. After such a reload Studio highlights what changed for about five seconds (new and changed elements badged, removed ones as ghosts; layout alone shows nothing), so you can follow an agent at work.

### Working alongside Studio

You can keep editing in Studio while an agent writes the same folder. Neither side overwrites the other:

- **Merged, not refused.** If a file changed between a call's read and its write (Studio saved, you edited a file, git pulled), the server merges its change with that edit, element by element and field by field, and says so in the result (`Merged with edits made in the folder while the call ran …`). Where both changed the same value, the folder's is kept and the result names it, so the agent can check it with `search_model`. Studio merges its own saves the same way. A change only to positions or sizes merges silently. A file that no longer reads as a model (git conflict markers, a half-written file) is not merged over: the call writes nothing and names the file.
- **Two writers at once.** Two servers on one folder (Claude Desktop and Claude Code), or a server and the desktop app, write it one at a time: each takes the folder's turn in `.radical/write.lock` for its check and its write, so the second finds the first one's change and merges with it. A turn left by a process that is gone, or held for 15 seconds, is taken over. Studio in a browser does not take turns; it merges as above.
- **Taking turns.** After each write the server marks the folder as being written by an agent in `.radical/agent-activity.json` (out of git, like the selection) for 15 seconds. Meanwhile Studio holds its saves: it says so once, takes in each change of the agent as it reloads, keeping your edits on top, and saves them when the agent pauses.

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
