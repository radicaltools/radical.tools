---
id: "13ab9449-714d-41f2-b853-664476d0f6d7"
type: "requirement"
label: "Agent builds views and flows"
action: "create and change named views of every kind (static, table, treemap, matrix, wiki, or dynamic playing a sequence), set the elements a view shows and the relations it hides, and record sequences of existing relations with a description per step, refusing a dynamic view without a sequence and steps on relations the model lacks"
ears_type: "event-driven"
rationale: "Agents shape the views and flows that people read, not only the elements. Evidence: packages/common/src/ai/tools/viewTools.ts, packages/common/src/ai/tools/sequenceTools.ts, apps/mcp/src/folderModel.ts (buildTools)"
trigger: "an agent creates or changes a view or a sequence through the AI tools"
---
