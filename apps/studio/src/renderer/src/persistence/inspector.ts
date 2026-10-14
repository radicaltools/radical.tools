// ─── radical check → Studio's Inspector ──────────────────────────────────────
//
// The Inspector shows what `radical check` says about the open model. The
// rules about the model run here, on the model as it is edited (checkModel
// from @radical/common, the code the CLI runs). What the tests say comes
// from the last `radical check --report`: the CLI keeps the test cases in
// the model folder's .radical/test-results.json, and the project's rule
// settings are the folder's check.json. Both are polled for the active
// md-folder document, as agentForge.ts polls the Forge run status. Nothing
// here writes.

import { create } from 'zustand'
import { checkModel, parseCheckConfig, parseTestResults, type CheckConfig, type CheckResult, type TestResults } from '@radical/common/check'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents, useDocumentsStore } from '../store/documentStore'
import { loadingDocumentId, onDocumentLoaded } from './autosave'

const POLL_MS = 3000
/** After the last change of the model, so a drag does not check every frame. */
const RECHECK_MS = 400

interface InspectorState {
  /** The test results kept beside the model, when there are any. */
  results: TestResults | null
  config: CheckConfig
  /** Why check.json could not be read, when it could not. */
  configError: string | null
  /** The check of the model as it is now. */
  check: CheckResult | null
}

export const useInspectorStore = create<InspectorState>(() => ({ results: null, config: {}, configError: null, check: null }))

/** The document whose test results and check.json have been read: the
 *  check waits for them, or a link that opens the Inspector showed the
 *  model without its test results first and then again with them. */
let filesReadFor: string | null = null

function recheck(): void {
  const id = documents.getActiveId()
  // Until the model and the files beside it are in, there is nothing whole
  // to show; the Inspector says it is checking.
  if (!id || filesReadFor !== id || loadingDocumentId() === id) return
  const { results, config } = useInspectorStore.getState()
  // saveDiagram gives the live model also while a milestone is on screen.
  const check = checkModel(useDiagramStore.getState().saveDiagram(), config, results ? { tests: results.cases } : {})
  useInspectorStore.setState({ check })
}

if (typeof window !== 'undefined') {
  let polledFor: string | null = null
  let lastResults = ''
  let lastConfig = ''

  const poll = async (): Promise<void> => {
    const id = documents.getActiveId()
    if (id !== polledFor) {
      polledFor = id
      filesReadFor = null
      lastResults = lastConfig = ''
      useInspectorStore.setState({ results: null, config: {}, configError: null, check: null })
    }
    if (!id) return
    const files = await documents.readCheckFiles(id).catch(() => null)
    // Not readable yet (a browser folder waits for its access): try again
    // on the next poll rather than check without them.
    if (documents.getActiveId() !== id || !files) return
    const resultsText = files.results ?? ''
    const configText = files.config ?? ''
    if (filesReadFor === id && resultsText === lastResults && configText === lastConfig) return
    filesReadFor = id
    lastResults = resultsText
    lastConfig = configText
    let config: CheckConfig = {}
    let configError: string | null = null
    if (configText) {
      try { config = parseCheckConfig(configText) } catch (error) { configError = `check.json: ${(error as Error).message}` }
    }
    useInspectorStore.setState({ results: resultsText ? parseTestResults(resultsText) : null, config, configError })
    recheck()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  useDiagramStore.subscribe((s, prev) => {
    if (s.c4Nodes === prev.c4Nodes && s.c4Relations === prev.c4Relations && s.views === prev.views
      && s.sequences === prev.sequences && s.presentations === prev.presentations && s.metamodel === prev.metamodel
      && s.liveBackup === prev.liveBackup) return
    clearTimeout(timer)
    timer = setTimeout(recheck, RECHECK_MS)
  })
  // The model of the active document is in, and its folder can be read:
  // read the files beside it now rather than at the next poll.
  onDocumentLoaded((id) => { if (id === documents.getActiveId()) { recheck(); void poll() } })

  setInterval(() => { void poll() }, POLL_MS)
  useDocumentsStore.subscribe((s) => { if (s.activeId !== polledFor) void poll() })
  void poll()
}
