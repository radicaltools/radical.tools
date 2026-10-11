---
id: "01140a26-a20b-4a3b-901a-be71a0d27c28"
type: "requirement"
label: "Open model file"
action: "Studio shall add the chosen JSON model to the model list, bound to the file on disk in the desktop app and copied into a new local-storage model in the browser, and ignore a file without nodes and relations arrays."
ears_type: "event-driven"
rationale: "Brings existing .radical (as downloaded from the Hub), .c4.json and JSON models in without conversion; the desktop and browser pickers accept all three since #118. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:693-744; apps/studio/src/main/index.ts:118-131; apps/studio/tests/openFile.test.ts; manual#formats"
trigger: "the user picks a model file with Open file…"
---
