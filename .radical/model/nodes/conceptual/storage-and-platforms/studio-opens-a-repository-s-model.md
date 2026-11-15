---
id: "f2ad46cb-6299-4832-ab87-69c3f45e3085"
type: "requirement"
label: "Studio opens a repository's model"
action: "Studio shall open the model in .radical/model, else in architecture/, in the order the CLI looks for it, named after the repository, read the repository's .radical/radical.json beside it, and ask again for access to the folder that holds that file whenever it asks again for the model's; a folder with files and no model it shall not open and write nothing in, saying it holds no model, while an empty folder (hidden entries aside) starts a new model"
ears_type: "event-driven"
rationale: "Taken for an empty model, a folder of other files got a second model written beside the repository's code at the first edit, and a repository laid out the old way was not found (F-0120, round 201–210). One rule, shared with the CLI, says where a folder's model is. Evidence: packages/common/src/modelFolders.ts (modelFolderCandidates, startsEmpty, noModelIn); apps/studio/src/renderer/src/persist/webFolder.ts; apps/studio/src/main/index.ts"
trigger: "the user opens a folder in Studio that is no model folder: a repository holding .radical/model or, laid out the old way, architecture/, that .radical/ folder itself (an open dialog hides .radical/, and one shown hidden folders may pick it), or a folder of other files"
---
