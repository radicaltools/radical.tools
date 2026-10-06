# Radical folder MCP server

This local stdio MCP server lets Codex read and edit one Radical **Markdown model folder**. Point it at a folder containing `radical.md`, `nodes/**/*.md` and the JSON sidecars, or at an empty or missing folder, which becomes a new model. Studio's browser folder watcher reloads outside edits on its normal poll, so changes appear on the open canvas without a separate browser connection.

## Build and connect

Use Node.js 20 or newer. From the repository root:

```sh
npm install
npm run build -w @radical/mcp
node apps/mcp/dist/index.js --folder /absolute/path/to/my-model
```

The last command waits for MCP messages on stdin; it prints no banner to stdout. `--folder` may be relative to the directory the server starts in. A missing or empty folder (dot files such as `.git` don't count) becomes a new, empty model; `--metamodel c4`, `c4-ddd` or `governance` picks its metamodel (default `governance`, Studio's default). A folder with other files and no `radical.md` is refused. To connect Codex, run the following with absolute paths (or add the equivalent `command` and `args` in [Codex's MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)):

```sh
codex mcp add radical-folder -- node /absolute/path/to/radical.tools/apps/mcp/dist/index.js --folder /absolute/path/to/my-model
codex mcp list
```

Claude Code takes the same command (`claude mcp add radical-folder -- node … --folder …`). For Claude Desktop, add it under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json`, with an absolute path to `node`, because the app does not see your shell's `PATH`.

Launch Studio with `npm run dev:web` from the repository root, open it in Chromium, and open the **same OS folder** via the Models dialog. The browser asks for File System Access permission. The MCP server cannot access a browser-only OPFS folder. Ask the client to use `get_model_summary` first, then `search_model` or the node/relation tools.

## Tool and file behavior

The server binds to one folder at launch, then reads it afresh for every tool call. Its tools are the shared AI tool catalogue from `@radical/common/ai/tools`, the one Studio's AI chat and Radical Forge use, minus the canvas-only `set_active_view` and `focus_node` and the destructive `reset_diagram`. It provides:

- `get_model_summary` (counts, views, sequences, presentations and the metamodel rules) and `search_model` (a small query language, including `LIST SEQUENCES` and `GET SEQUENCE`);
- `add_`, `update_` and `delete_` tools for nodes and relations, and `move_node` to change a node's parent (it keeps the node's canvas position and enforces the metamodel's `allowedParents`);
- `create_view`, `update_view` (name, kind, linked sequence, hidden relations), `set_view_nodes` and `delete_view`;
- `create_sequence`, `update_sequence` and `delete_sequence`: ordered relation flows that a `dynamic` view plays;
- `create_presentation`, `update_presentation` and `delete_presentation`: slides over views, which Studio frames to fit;
- `upsert_node_type`, `delete_node_type`, `upsert_relation_type` and `delete_relation_type`. A built-in metamodel is copied to a `…-custom` id on the first edit, because Studio replaces built-in metamodels with their preset on load. After a metamodel change (from these tools or from Studio) the server re-advertises the node and relation tool schemas;
- `smart_layout`, for All elements or one static or dynamic view (`viewId`), which then gets its own saved positions.

 These use Studio's shared schemas and model rules. Besides counts, `get_model_summary` returns the metamodel context message the other tool descriptions refer to: each type's property keys and enum options, allowed parents, cardinality and relation pairs. The server's MCP instructions tell clients to call it first. New nodes are placed inside their parent below its header (root nodes to the right of the existing ones), and every parent a change adds to, moves or removes from is refitted to its children. `smart_layout` runs Studio's Smart Layout over the whole model (the **All elements** arrangement) and saves the result; views with their own saved positions keep them. Writes also update `defaultPositions`, which Studio restores when you switch back to **All elements**. `add_node` returns the persisted real ID, and a `tempId` can be used in later calls on the same MCP connection. Newly added nodes appear in Studio's **All elements** view until a view lists them. The server refreshes its model data per call.

Writes preserve unrelated files and the existing `radical.md` text. A tool reports success only after the changed model files are written. If a file changed between the server's read and write, it returns a conflict without writing. Studio's external-change reload no longer queues an autosave of the loaded data.

For now, keep Studio in **viewer use while the MCP client writes**. Folder writes span several files, and Studio and MCP do not share a cross-process transaction lock. Editing the same folder simultaneously from both can still race; the stamp check only catches changes visible before a write begins. Single `.radical` JSON files, snapshots (milestones), browser commands, and remote HTTP MCP are not supported by this server.

Run `npm run test -w @radical/mcp` to build and exercise a real stdio connection and temporary disk folder.
