// ─── radical check → Studio's Inspector ──────────────────────────────────────
//
// The Inspector shows what `radical check` says about the open model. The
// rules about the model run here, on the model as it is edited (checkModel
// from @radical/common, the code the CLI runs). What the tests say comes
// from the last `radical check --report`: the CLI keeps the test cases in
// the model folder's .radical/test-results.json, and the project's rule
// settings are the folder's check.json. Both are polled for the active
// md-folder document, as agentForge.ts polls the Forge run status. The
// only write is saveCheckConfig, when the Inspector's Settings are saved.

import { create } from 'zustand'
import { checkModel, parseCheckConfig, parseMeasurementStore, parseTestResults, type CheckConfig, type CheckResult, type Measurement, type TestResults } from '@radical/common/check'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { loadBundledConcepts } from '@radical/ui/store/hubStore'
import { concernPacks, type ConcernPack } from '@radical/common/concerns'
import { samePlacesAside } from '@radical/common/model'
import { documents, useDocumentsStore } from '../store/documentStore'
import { loadingDocumentId, onDocumentLoaded } from './autosave'

const POLL_MS = 3000
/** After the last change of the model, so a drag does not check every frame. */
const RECHECK_MS = 400

interface InspectorState {
  /** The test results kept beside the model, when there are any. */
  results: TestResults | null
  /** What `radical sense` measured, kept beside the model, when there is a
   *  store of it. */
  measurements: Measurement[] | null
  config: CheckConfig
  /** Why check.json could not be read, when it could not. */
  configError: string | null
  /** The check of the model as it is now. */
  check: CheckResult | null
  /** check.json as read, so Settings can tell a change of its own from the
   *  file; empty when there is none. */
  configText: string
  /** Settings edited and not saved yet, by document: kept when the user goes
   *  to another tab, perspective or model, and back. */
  settingsDrafts: Record<string, CheckConfig>
}

export const useInspectorStore = create<InspectorState>(() => ({ results: null, measurements: null, config: {}, configError: null, check: null, configText: '', settingsDrafts: {} }))

/** The unsaved Settings of the active document, or null. */
export function useSettingsDraft(): CheckConfig | null {
  const id = useDocumentsStore((s) => s.activeId)
  return useInspectorStore((s) => (id && s.settingsDrafts[id]) || null)
}

/** Sets (or with null, drops) the unsaved Settings of the active document;
 *  a function gets the draft as it is now. */
export function setSettingsDraft(next: CheckConfig | null | ((draft: CheckConfig | null) => CheckConfig | null)): void {
  const id = documents.getActiveId()
  if (!id) return
  useInspectorStore.setState((s) => {
    const draft = typeof next === 'function' ? next(s.settingsDrafts[id] ?? null) : next
    const settingsDrafts = { ...s.settingsDrafts }
    if (draft) settingsDrafts[id] = draft
    else delete settingsDrafts[id]
    return { settingsDrafts }
  })
}

/** check.json as Settings write it. */
export const serializeCheckConfig = (config: CheckConfig): string => JSON.stringify(config, null, 2) + '\n'

/** Saves `config` as the active document's check.json and checks the model
 *  with it at once, without waiting for the next poll to read it back. */
export async function saveCheckConfig(config: CheckConfig): Promise<void> {
  const id = documents.getActiveId()
  if (!id) throw new Error('No model is open.')
  const text = serializeCheckConfig(config)
  await documents.writeCheckConfig(id, text)
  if (documents.getActiveId() !== id) return
  lastConfig = text
  useInspectorStore.setState({ config, configError: null, configText: text })
  recheck()
}

let lastConfig = ''

/** The concern packs of the catalogue Studio bundles: read from the app,
 *  not hub.radical.tools, so the critic needs no network and checks against
 *  the packs of this version. */
let packs: ConcernPack[] = []
let packsLoading: Promise<void> | null = null

/** Opens the Hub import dialog (Toolbar.tsx listens) on a concern pack,
 *  bound to an element: the Inspector's answer to a concern-unaddressed
 *  finding. */
export const OPEN_HUB_EVENT = 'radical:open-hub'
export function openConcern(packId: string, elementId?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_HUB_EVENT, { detail: { ids: [packId], bindTo: elementId } }))
}

/** The document whose test results and check.json have been read: the
 *  check waits for them, or a link that opens the Inspector showed the
 *  model without its test results first and then again with them. */
let filesReadFor: string | null = null

function recheck(): void {
  const id = documents.getActiveId()
  // Until the model and the files beside it are in, there is nothing whole
  // to show; the Inspector says it is checking.
  if (!id || filesReadFor !== id || loadingDocumentId() === id) return
  const { results, measurements, config } = useInspectorStore.getState()
  // saveDiagram gives the live model also while a milestone is on screen.
  // The Hub's concern packs, for concern-unaddressed (none until loaded).
  const concerns = packs
  const check = checkModel(useDiagramStore.getState().saveDiagram(), config, { ...(results ? { tests: results.cases } : {}), ...(measurements ? { measurements } : {}), concerns })
  useInspectorStore.setState({ check })
}

if (typeof window !== 'undefined') {
  let polledFor: string | null = null
  let lastResults = ''
  let lastMeasurements = ''

  const poll = async (): Promise<void> => {
    const id = documents.getActiveId()
    if (id !== polledFor) {
      polledFor = id
      filesReadFor = null
      lastResults = lastConfig = lastMeasurements = ''
      useInspectorStore.setState({ results: null, measurements: null, config: {}, configError: null, check: null, configText: '' })
    }
    if (!id) return
    const files = await documents.readCheckFiles(id).catch(() => null)
    // Not readable yet (a browser folder waits for its access): try again
    // on the next poll rather than check without them.
    if (documents.getActiveId() !== id || !files) return
    const resultsText = files.results ?? ''
    const configText = files.config ?? ''
    const measurementsText = files.measurements ?? ''
    if (filesReadFor === id && resultsText === lastResults && configText === lastConfig && measurementsText === lastMeasurements) return
    filesReadFor = id
    // The concern packs, once, for a model that has a check report or
    // settings beside it: the one the Inspector is for.
    if ((resultsText || configText || measurementsText) && !packsLoading) {
      packsLoading = loadBundledConcepts().then((concepts) => { packs = concernPacks(concepts); recheck() })
    }
    lastResults = resultsText
    lastConfig = configText
    lastMeasurements = measurementsText
    let config: CheckConfig = {}
    let configError: string | null = null
    if (configText) {
      try { config = parseCheckConfig(configText) } catch (error) { configError = `check.json: ${(error as Error).message}` }
    }
    useInspectorStore.setState({ results: resultsText ? parseTestResults(resultsText) : null, measurements: measurementsText ? parseMeasurementStore(measurementsText) : null, config, configError, configText })
    recheck()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  useDiagramStore.subscribe((s, prev) => {
    // Elements moved (the live layout, every frame) change nothing it checks.
    if (samePlacesAside(prev.c4Nodes, s.c4Nodes) && s.c4Relations === prev.c4Relations && s.views === prev.views
      && s.sequences === prev.sequences && s.presentations === prev.presentations && s.metamodel === prev.metamodel
      && s.liveBackup === prev.liveBackup) return
    clearTimeout(timer)
    timer = setTimeout(recheck, RECHECK_MS)
  })
  // The model of the active document is in, and its folder can be read:
  // read the files beside it now rather than at the next poll.
  // The check waits a moment, as after an edit: a model of 21,000 elements
  // took 0.8 s to check, and the model opened that much later.
  onDocumentLoaded((id) => { if (id === documents.getActiveId()) { clearTimeout(timer); timer = setTimeout(recheck, RECHECK_MS); void poll() } })


  setInterval(() => { void poll() }, POLL_MS)
  useDocumentsStore.subscribe((s) => { if (s.activeId !== polledFor) void poll() })
  void poll()
}
