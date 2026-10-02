# Radical folder MCP server

This local stdio MCP server lets Codex read and edit one Radical **Markdown model folder**. Point it at a folder containing `radical.md`, `nodes/**/*.md` and the JSON sidecars. Studio's browser folder watcher reloads outside edits on its normal poll, so changes appear on the open canvas without a separate browser connection.

## Build and connect

Use Node.js 20 or newer. From the repository root:

```sh
npm install
npm run build -w @radical/mcp
node apps/mcp/dist/index.js --folder /absolute/path/to/my-model
```

The last command waits for MCP messages on stdin; it prints no banner to stdout. To connect Codex, run the following with absolute paths (or add the equivalent `command` and `args` in [Codex's MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)):

```sh
codex mcp add radical-folder -- node /absolute/path/to/radical.tools/apps/mcp/dist/index.js --folder /absolute/path/to/my-model
codex mcp list
```

Launch Studio with `npm run dev:web` from the repository root, open it in Chromium, and open the **same OS folder** via the Models dialog. The browser asks for File System Access permission. The MCP server cannot access a browser-only OPFS folder. Ask Codex to use `get_model_summary` first, then `search_model` or the node/relation tools.

## Tool and file behavior

The server binds to one absolute folder path at launch, then reads it afresh for every tool call. It provides `get_model_summary`, `search_model`, and `add_`, `update_`, and `delete_` tools for nodes and relations. These use Studio's shared schemas and model rules. New nodes get a deterministic position; existing positions are not laid out again. `add_node` returns the persisted real ID, and a `tempId` can be used in later calls on the same MCP connection. Newly added nodes appear in Studio's **All elements** view; the server does not add them to named views. The server refreshes its model data per call, but if the metamodel's tool schemas change, restart the server.

Writes preserve unrelated files and the existing `radical.md` text. A tool reports success only after the changed model files are written. If a file changed between the server's read and write, it returns a conflict without writing. Studio's external-change reload no longer queues an autosave of the loaded data.

For now, keep Studio in **viewer use while Codex writes**. Folder writes span several files, and Studio and MCP do not share a cross-process transaction lock. Editing the same folder simultaneously from both can still race; the stamp check only catches changes visible before a write begins. Single `.radical` JSON files, view editing, browser commands, and remote HTTP MCP are not supported by this server.

Run `npm run test -w @radical/mcp` to build and exercise a real stdio connection and temporary disk folder.
