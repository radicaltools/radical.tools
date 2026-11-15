---
id: "62993f8e-93a7-4b61-8a98-e7a661c8a07d"
type: "requirement"
label: "Ask before foreign folder"
action: "Studio shall refuse a folder with a model below it where Open finds one, with a notice naming that model, writing nothing; write the model into a folder that holds files only after the user confirms, naming the model the folder holds when it holds one, leave the folder untouched when the user declines, and, once the user confirms replacing a model, take the replaced model's entry out of the Models list."
ears_type: "unwanted-behaviour"
rationale: "Saving into the wrong directory (a code repo root) must not silently scatter model files into it. Exploratory runs 65 to 69 (2026-10-21, item 235) found that Move to a folder… and New model → In a folder replaced another model's folder without a question, and both entries in the Models list then opened the new model. Evidence: apps/studio/src/renderer/src/store/documentStore.ts (mayWriteInto, forgetReplaced, saveAsFolder, createFolderDocument, confirmForeignFolder); apps/studio/src/renderer/src/components/DocumentManager.tsx. New model in a folder on a repository's root wrote a second model there without a question, and Open → Folder… then opened it in place of the repository's .radical/model (F-0164, round 211–220). Studio, the CLI and the MCP server share where a folder's model is: packages/common/src/modelFolders.ts (modelBelow, modelBelowRefusal)."
unwanted_condition: "the folder picked for Save as folder…, Move to a folder… or New model → In a folder already holds files (another model, a radical.md manifest, or files but no manifest), or has a model below it where Open finds one (.radical/model or architecture/)"
---
