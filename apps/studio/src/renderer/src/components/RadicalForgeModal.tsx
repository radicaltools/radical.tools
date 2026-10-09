import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { runAIPrompt, type ForgeProgressEvent } from '../ai/runner'
import { activeProviderNeedsKey, loadAISettings } from '../ai/settings'
import { getAdapter } from '../ai/registry'
import { useDiagramFacade } from '../ai/useDiagramFacade'
import {
  FORGE_ARRANGEMENTS,
  FORGE_STAGES,
  FORGE_STAGE_VIEW,
  HUB_MATCHES_QUESTION_ID,
  PRIMARY_TYPE_IDS_FOR_STAGE,
  arrangeForgeGroup,
  buildForgeStagePrompt,
  buildPriorStagesBlock,
  fileIntoForgeViews,
  findForgeView,
  forgeArrangeGroups,
  forgeHubCandidates,
  formatClarificationAnswers,
  needLabelFromDescription,
  type ClarifyStageQuestion,
  type ForgeArrangeGroup,
  type ForgeArrangement,
  type ForgeNeedRef,
  type ForgeStageId,
} from '@radical/common/ai/forge'
import { buildGherkinFiles } from '@radical/common/formats/exportGherkin'
import { downloadGherkinFiles } from '../export/downloadGherkinFiles'
import { AIReportLine } from './AIReportLine'
import { useHubStore, type HubConceptSummary } from '@radical/ui/store/hubStore'
import { importHubConceptIntoDiagram } from '../hub/importConcept'
import { askClarifyingQuestions } from '../ai/forgeClarify'
import { addTokenUsage, type AISettings, type TokenUsage } from '../ai/types'
import type { ApplyReport } from '@radical/common/ai/diagramFacade'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { generateWireframe } from '../ai/mockupWireframe'
import { addedSince, currentModelIds, removeAdded, type ModelIds } from '../ai/forgeStageOutput'

type ClarifyStatus = 'asking' | 'form' | 'done'

/** Batch wireframe generation after the Mockups stage — one tool-less call
 *  per mockup (ai/mockupWireframe.ts), run sequentially so a large batch
 *  doesn't trip provider rate limits. */
interface WireframeRun {
  total: number
  done: number
  failed: number
  /** Label of the mockup currently being drawn (while running). */
  current?: string
  running: boolean
}
type ClarifyAnswers = Record<string, string | string[]>

/** After a stage: its new elements per view, and what the user did with
 *  them — kept in a row, column or grid, and/or laid out. */
interface StageArrange {
  groups: ForgeArrangeGroup[]
  arranged?: ForgeArrangement
  laidOut?: boolean
  message?: string
  failed?: boolean
}

const ARRANGEMENT_LABELS: Record<ForgeArrangement, string> = { row: 'Row', column: 'Column', grid: 'Grid' }

interface ProgressEntry {
  id: number
  kind: 'text' | 'action'
  text: string
  ok?: boolean
}
interface StageProgress {
  round: number
  entries: ProgressEntry[]
  usage?: TokenUsage
}
/** Compact "3.2K" style formatting — token counts get large fast across a
 *  multi-stage Forge run, and nobody needs the exact digit. */
function formatTokenCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}
/** Caps the live feed so a long run doesn't grow the DOM unbounded — only
 *  the tail is ever shown anyway. */
const PROGRESS_ENTRY_LIMIT = 40
const PROGRESS_VISIBLE_COUNT = 7

interface Props {
  open: boolean
  onClose: () => void
}

type WizardStep = 'input' | ForgeStageId | 'export'

const STEP_ORDER: WizardStep[] = ['input', ...FORGE_STAGES.map((s) => s.id), 'export']
export const STEP_LABELS: Record<WizardStep, string> = {
  input: 'Description',
  requirements: 'Requirements',
  domain: 'Domain',
  c4: 'C4',
  fitness: 'Fitness',
  scenarios: 'Scenarios',
  states: 'States',
  mockups: 'Mockups',
  export: 'Finish',
}

/** Browser-only text-file picker (mirrors documentStore.ts's defaultWebFilePicker,
 *  scoped to plain-text description files instead of .radical/.json). */
function pickTextFile(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.md,text/plain,text/markdown'
    input.style.display = 'none'
    let settled = false
    const finish = (v: string | null): void => {
      if (settled) return
      settled = true
      try { document.body.removeChild(input) } catch { /* already gone */ }
      resolve(v)
    }
    input.addEventListener('change', () => {
      const f = input.files?.[0]
      if (!f) { finish(null); return }
      const reader = new FileReader()
      reader.onload = () => finish(String(reader.result ?? ''))
      reader.onerror = () => finish(null)
      reader.readAsText(f)
    })
    const onFocus = (): void => {
      window.removeEventListener('focus', onFocus)
      setTimeout(() => { if (!input.files || input.files.length === 0) finish(null) }, 300)
    }
    window.addEventListener('focus', onFocus)
    document.body.appendChild(input)
    input.click()
  })
}

const NO_NODES: Record<string, C4Node> = {}
const NO_RELATIONS: Record<string, C4Relation> = {}

export function RadicalForgeModal({ open, onClose }: Props): React.ReactElement | null {
  const [step, setStep] = useState<WizardStep>('input')
  const [description, setDescription] = useState('')
  /** The `need` node the description lives in — picked on the Description
   *  step, or created from the typed text when the run starts (ensureNeed).
   *  null = a new need will be created. */
  const [needId, setNeedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageReports, setStageReports] = useState<Partial<Record<ForgeStageId, ApplyReport>>>({})
  const [stageSummaries, setStageSummaries] = useState<Partial<Record<ForgeStageId, string>>>({})
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadAISettings())
  const [importedHubIds, setImportedHubIds] = useState<Set<string>>(new Set())
  const [importingHubId, setImportingHubId] = useState<string | null>(null)
  const [clarifyStatusByStage, setClarifyStatusByStage] = useState<Partial<Record<ForgeStageId, ClarifyStatus>>>({})
  const [clarifyQuestionsByStage, setClarifyQuestionsByStage] = useState<Partial<Record<ForgeStageId, ClarifyStageQuestion[]>>>({})
  const [clarifyAnswersByStage, setClarifyAnswersByStage] = useState<Partial<Record<ForgeStageId, ClarifyAnswers>>>({})
  const [progressByStage, setProgressByStage] = useState<Partial<Record<ForgeStageId, StageProgress>>>({})
  /** Running total across every stage generated so far this wizard session —
   *  undefined until the first stage with usage data completes. */
  const [sessionUsage, setSessionUsage] = useState<TokenUsage | undefined>(undefined)
  const [wireframeRun, setWireframeRun] = useState<WireframeRun | null>(null)
  const [arrangeByStage, setArrangeByStage] = useState<Partial<Record<ForgeStageId, StageArrange>>>({})
  /** The Hub concepts the model picked from each stage's candidates. */
  const [hubPicksByStage, setHubPicksByStage] = useState<Partial<Record<ForgeStageId, HubConceptSummary[]>>>({})
  const [layingOut, setLayingOut] = useState(false)
  /** Furthest step reached by normal forward navigation — stepper tabs past
   *  it stay disabled. An early finish jumps to the last step without
   *  raising this, so stages the user never reached can't be opened from
   *  the stepper (they resume via ← Back instead). */
  const [reachedIndex, setReachedIndex] = useState(0)
  /** Stage the user explicitly finished the run at ("Finish here"), or null
   *  when the run went through every stage / hasn't finished. */
  const [finishedAt, setFinishedAt] = useState<ForgeStageId | null>(null)
  const progressIdRef = useRef(0)
  const progressListRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Stages the clarify effect below has already started for this wizard run
  // — a ref, not state, so starting a fetch doesn't itself change an effect
  // dependency (see the effect for why that would matter).
  const clarifyStartedRef = useRef<Set<ForgeStageId>>(new Set())
  // What each stage's last run added, so Regenerate can take it out first.
  const stageAddedRef = useRef<Partial<Record<ForgeStageId, ModelIds>>>({})
  const diagram = useDiagramFacade()

  const currentStageId: ForgeStageId | null = FORGE_STAGES.some((s) => s.id === step) ? (step as ForgeStageId) : null

  const hubConcepts = useHubStore((s) => s.concepts)
  const fetchHubConcepts = useHubStore((s) => s.fetchConcepts)
  const loadHubConcept = useHubStore((s) => s.loadConcept)
  const activeMetamodelId = useDiagramStore((s) => s.metamodel?.id)
  // Metamodels without the governance `need` type (plain C4, custom ones)
  // run Forge as before, without storing the description in the model.
  const hasNeedType = useDiagramStore((s) => !!s.metamodel?.nodeTypes.need)

  // Reset to a clean run every time the wizard is (re)opened.
  useEffect(() => {
    if (!open) return
    setStep('input')
    setDescription('')
    setNeedId(null)
    setBusy(false)
    setError(null)
    setStageReports({})
    setStageSummaries({})
    setAiSettings(loadAISettings())
    setImportedHubIds(new Set())
    setClarifyStatusByStage({})
    setClarifyQuestionsByStage({})
    setClarifyAnswersByStage({})
    setProgressByStage({})
    setSessionUsage(undefined)
    setWireframeRun(null)
    setArrangeByStage({})
    setHubPicksByStage({})
    setReachedIndex(0)
    setFinishedAt(null)
    clarifyStartedRef.current = new Set()
    stageAddedRef.current = {}
  }, [open])

  useEffect(() => {
    if (open) fetchHubConcepts()
  }, [open, fetchHubConcepts])

  // Keep settings fresh if the user opens "AI providers…" mid-wizard.
  useEffect(() => {
    if (!open) return
    const refresh = (): void => setAiSettings(loadAISettings())
    window.addEventListener('storage', refresh)
    window.addEventListener('radical:ai-settings-changed', refresh as EventListener)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('radical:ai-settings-changed', refresh as EventListener)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const providerLabel = getAdapter(aiSettings.active).label
  const needsKey = activeProviderNeedsKey(aiSettings)
  const unavailableReason = !aiSettings.enabled
    ? 'AI features are disabled.'
    : needsKey
      ? `Set an API key for ${providerLabel} first.`
      : null

  const openAISettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('radical:open-ai-settings'))
  }, [])

  const handleUpload = useCallback(async () => {
    const text = await pickTextFile()
    if (text) setDescription(text)
  }, [])

  // Per stage: the keyword-ranked candidates the clarify call lets the model
  // pick from, and the few suggested until it has (or when there is no AI).
  const hubByStage = useMemo(
    () => forgeHubCandidates(hubConcepts, description, activeMetamodelId).stages,
    [hubConcepts, description, activeMetamodelId],
  )
  const hubMatchesByStage = useMemo(
    () => Object.fromEntries(FORGE_STAGES.map((s) => [s.id, hubPicksByStage[s.id] ?? hubByStage[s.id]?.suggested])) as Partial<Record<ForgeStageId, HubConceptSummary[]>>,
    [hubByStage, hubPicksByStage],
  )

  // Fires once per stage, the moment it becomes current: asks the model
  // whether it needs clarifying questions before generating. Skips the call
  // entirely when AI isn't configured (Generate is disabled anyway) or the
  // stage was already generated (revisiting a done stage shouldn't re-ask).
  //
  // Guards re-entry with a ref (clarifyStartedRef), not the clarifyStatusByStage
  // state this effect itself sets: putting that state in the dependency array
  // made every setClarifyStatusByStage call re-trigger the effect, whose
  // cleanup then set `cancelled = true` on the in-flight request before the
  // re-run's own guard bailed out (status was already non-empty) — the
  // response would arrive, see `cancelled`, and silently no-op, leaving the
  // stage stuck on "Checking for clarifying questions…" forever. Reading
  // stageReports/unavailableReason/description/hubByStage/aiSettings
  // without listing them is deliberate for the same reason — this is a
  // fire-once-per-stage-entry effect, not a sync-on-every-change one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !currentStageId) return
    if (clarifyStartedRef.current.has(currentStageId)) return
    if (stageReports[currentStageId] || unavailableReason) {
      clarifyStartedRef.current.add(currentStageId)
      setClarifyStatusByStage((s) => ({ ...s, [currentStageId]: 'done' }))
      return
    }
    clarifyStartedRef.current.add(currentStageId)
    const stage = FORGE_STAGES.find((s) => s.id === currentStageId)!
    setClarifyStatusByStage((s) => ({ ...s, [currentStageId]: 'asking' }))
    // So the model doesn't re-ask something the user already answered in an
    // earlier stage's clarify round (e.g. auth mechanism asked again at the
    // C4 stage after already being answered at Requirements).
    const priorQA = FORGE_STAGES
      .slice(0, FORGE_STAGES.findIndex((s) => s.id === currentStageId))
      .map((s) => formatClarificationAnswers(clarifyQuestionsByStage[s.id], clarifyAnswersByStage[s.id]))
      .filter(Boolean)
      .join('\n\n')
    askClarifyingQuestions(stage.title, description, hubByStage[currentStageId]?.candidates, aiSettings, undefined, priorQA)
      .then(({ questions, picked, usage }) => {
        // An unreadable reply keeps the keyword suggestions.
        if (picked) setHubPicksByStage((p) => ({ ...p, [currentStageId]: picked }))
        setClarifyQuestionsByStage((q) => ({ ...q, [currentStageId]: questions }))
        // multiSelect questions (in practice, just hub_matches) default to
        // "everything selected" — unless the user deselects something,
        // generation behaves exactly like it did before this feature.
        const defaults: ClarifyAnswers = {}
        for (const q of questions) {
          if (q.kind === 'select' && q.multiSelect) defaults[q.id] = q.options ?? []
        }
        setClarifyAnswersByStage((a) => ({ ...a, [currentStageId]: defaults }))
        setClarifyStatusByStage((s) => ({ ...s, [currentStageId]: questions.length ? 'form' : 'done' }))
        // The clarify call is real spend too, even though it never touches
        // the diagram — count it in both the per-stage and session totals
        // just like a generation round.
        if (usage) {
          setProgressByStage((p) => ({ ...p, [currentStageId]: { ...(p[currentStageId] ?? { round: 0, entries: [] }), usage: addTokenUsage(p[currentStageId]?.usage, usage) } }))
          setSessionUsage((u) => addTokenUsage(u, usage))
        }
      })
      .catch(() => {
        // A failed clarify call shouldn't block generation — just skip
        // straight to "done" (no questions); the real error (if any) will
        // resurface when Generate itself is clicked.
        setClarifyStatusByStage((s) => ({ ...s, [currentStageId]: 'done' }))
      })
  }, [open, currentStageId])

  const setClarifyAnswer = useCallback((stageId: ForgeStageId, questionId: string, value: string | string[]) => {
    setClarifyAnswersByStage((prev) => ({
      ...prev,
      [stageId]: { ...(prev[stageId] ?? {}), [questionId]: value },
    }))
  }, [])

  const toggleClarifyOption = useCallback((stageId: ForgeStageId, questionId: string, option: string) => {
    setClarifyAnswersByStage((prev) => {
      const current = (prev[stageId]?.[questionId] as string[] | undefined) ?? []
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
      return { ...prev, [stageId]: { ...(prev[stageId] ?? {}), [questionId]: next } }
    })
  }, [])

  const submitClarify = useCallback((stageId: ForgeStageId) => {
    setClarifyStatusByStage((s) => ({ ...s, [stageId]: 'done' }))
  }, [])

  const skipClarify = useCallback((stageId: ForgeStageId) => {
    setClarifyAnswersByStage((a) => ({ ...a, [stageId]: {} }))
    setClarifyStatusByStage((s) => ({ ...s, [stageId]: 'done' }))
  }, [])

  const editClarify = useCallback((stageId: ForgeStageId) => {
    setClarifyStatusByStage((s) => ({ ...s, [stageId]: 'form' }))
  }, [])

  const runStage = useCallback(async (stageId: ForgeStageId) => {
    if (busy || unavailableReason) return
    setBusy(true)
    setError(null)
    // Regenerate replaces the previous attempt instead of adding a second copy.
    const previous = stageAddedRef.current[stageId]
    if (previous) removeAdded(previous)
    setArrangeByStage((a) => ({ ...a, [stageId]: undefined }))
    // The stage builds on its view, so its elements land there as they come.
    // A view it is the first to fill does not exist yet (an empty view shows
    // the whole model): it is made from them afterwards, on All elements.
    const stageView = findForgeView(useDiagramStore.getState().views, FORGE_STAGE_VIEW[stageId])
    useDiagramStore.getState().setActiveView(stageView?.id ?? null)
    const before = currentModelIds()
    setProgressByStage((p) => ({ ...p, [stageId]: { round: 0, entries: [] } }))
    const ctl = new AbortController()
    abortRef.current = ctl
    const onProgress = (event: ForgeProgressEvent): void => {
      setProgressByStage((p) => {
        const cur = p[stageId] ?? { round: 0, entries: [] }
        if (event.type === 'round') return { ...p, [stageId]: { ...cur, round: event.round } }
        if (event.type === 'usage') return { ...p, [stageId]: { ...cur, usage: event.usage } }
        const id = progressIdRef.current++
        const entry: ProgressEntry = event.type === 'text'
          ? { id, kind: 'text', text: event.text }
          : { id, kind: 'action', text: event.label, ok: event.ok }
        const entries = [...cur.entries, entry].slice(-PROGRESS_ENTRY_LIMIT)
        return { ...p, [stageId]: { ...cur, entries } }
      })
    }
    try {
      const allMatches = hubMatchesByStage[stageId] ?? []
      const answers = clarifyAnswersByStage[stageId]
      const hubAnswer = answers?.[HUB_MATCHES_QUESTION_ID]
      // A hub_matches answer restricts guidance to what the user kept
      // checked; no such question this run (e.g. no Hub matches existed, or
      // the model didn't ask) means "use everything found", same as before
      // this feature.
      const effectiveMatches = Array.isArray(hubAnswer)
        ? allMatches.filter((m) => hubAnswer.includes(m.name))
        : allMatches
      const clarifications = formatClarificationAnswers(clarifyQuestionsByStage[stageId], answers)
      const stageIdx = FORGE_STAGES.findIndex((s) => s.id === stageId)
      const priorStageSummaries = buildPriorStagesBlock(
        FORGE_STAGES.slice(0, stageIdx).map((s) => ({ title: s.title, summary: stageSummaries[s.id] ?? '' })),
      )
      const needNode = needId ? useDiagramStore.getState().c4Nodes[needId] : undefined
      const needRef: ForgeNeedRef | undefined = needNode ? { id: needNode.id, label: needNode.label } : undefined
      const prompt = buildForgeStagePrompt(stageId, description, effectiveMatches, clarifications, priorStageSummaries, needRef)
      const relevantTypeIds = new Set(PRIMARY_TYPE_IDS_FOR_STAGE[stageId])
      const result = await runAIPrompt({
        prompt, settings: aiSettings, diagram, signal: ctl.signal, onProgress, relevantTypeIds,
        // Forge builds the model; editing types or slides is out of scope and costs schema tokens every stage.
        excludeToolGroups: ['metamodel', 'presentation', 'milestone'],
      })
      setStageReports((r) => ({ ...r, [stageId]: result.report }))
      setStageSummaries((s) => ({ ...s, [stageId]: result.summary || 'Done.' }))
      if (result.usage) {
        setProgressByStage((p) => ({ ...p, [stageId]: { ...(p[stageId] ?? { round: 0, entries: [] }), usage: result.usage } }))
        setSessionUsage((u) => addTokenUsage(u, result.usage))
      }
    } catch (err) {
      setError((err as Error).message || String(err))
    } finally {
      const added = addedSince(before)
      stageAddedRef.current[stageId] = added
      // Each element into its view (Conceptual, Logical & physical, Governance),
      // and the stage's view on screen.
      fileIntoForgeViews(diagram, added.nodes, stageId)
      const target = findForgeView(useDiagramStore.getState().views, FORGE_STAGE_VIEW[stageId])
      if (target) useDiagramStore.getState().setActiveView(target.id)
      setArrangeByStage((a) => ({ ...a, [stageId]: { groups: forgeArrangeGroups(diagram, added.nodes, stageId) } }))
      abortRef.current = null
      setBusy(false)
    }
  }, [busy, unavailableReason, description, needId, hubMatchesByStage, clarifyAnswersByStage, clarifyQuestionsByStage, aiSettings, diagram, stageSummaries])

  /** Keeps the stage's new elements in a row, column or grid on their view. */
  const arrangeStage = useCallback((stageId: ForgeStageId, arrangement: ForgeArrangement) => {
    const current = arrangeByStage[stageId]
    if (!current || busy || layingOut) return
    const results = current.groups
      .filter((g) => g.nodeIds.length >= 2)
      .map((g) => arrangeForgeGroup(diagram, g, arrangement))
    const failed = results.some((r) => !r.ok)
    setArrangeByStage((a) => ({
      ...a,
      [stageId]: { ...current, arranged: failed ? current.arranged : arrangement, message: results.map((r) => r.text).join(' '), failed },
    }))
  }, [arrangeByStage, busy, layingOut, diagram])

  /** Smart Layout on every view the stage added to, its own view last so it
   *  stays on screen. */
  const layoutStage = useCallback(async (stageId: ForgeStageId) => {
    const current = arrangeByStage[stageId]
    if (!current || busy || layingOut || !diagram.runLayout) return
    const own = findForgeView(useDiagramStore.getState().views, FORGE_STAGE_VIEW[stageId])?.id
    const viewIds = [...new Set(current.groups.map((g) => g.viewId))].sort((a, b) => Number(a === own) - Number(b === own))
    setLayingOut(true)
    try {
      const texts: string[] = []
      for (const viewId of viewIds) {
        const outcome = await diagram.runLayout(viewId)
        texts.push(outcome.text)
        if (!outcome.ok) throw new Error(outcome.text)
      }
      setArrangeByStage((a) => ({ ...a, [stageId]: { ...current, laidOut: true, message: texts.join(' '), failed: false } }))
    } catch (err) {
      setArrangeByStage((a) => ({ ...a, [stageId]: { ...current, message: (err as Error).message || String(err), failed: true } }))
    } finally {
      setLayingOut(false)
    }
  }, [arrangeByStage, busy, layingOut, diagram])

  const cancelStage = useCallback(() => { abortRef.current?.abort() }, [])

  const generateMissingWireframes = useCallback(async () => {
    if (busy || unavailableReason) return
    const { c4Nodes } = useDiagramStore.getState()
    const targets = Object.values(c4Nodes).filter(
      (n) => n.type === 'mockup' && !(n as unknown as Record<string, unknown>).wireframe,
    )
    if (!targets.length) return
    setBusy(true)
    setError(null)
    const ctl = new AbortController()
    abortRef.current = ctl
    let done = 0
    let failed = 0
    setWireframeRun({ total: targets.length, done, failed, running: true })
    try {
      for (const target of targets) {
        if (ctl.signal.aborted) break
        setWireframeRun({ total: targets.length, done, failed, current: target.label, running: true })
        try {
          // Re-read the model each time: earlier wireframes / user edits
          // made while the batch runs are then part of the next prompt.
          const { c4Nodes: nodes, c4Relations, updateNode } = useDiagramStore.getState()
          if (!nodes[target.id]) continue
          const { svg, usage } = await generateWireframe(target.id, nodes, c4Relations, aiSettings, ctl.signal)
          updateNode(target.id, { wireframe: svg } as Parameters<typeof updateNode>[1])
          if (usage) setSessionUsage((u) => addTokenUsage(u, usage))
        } catch (err) {
          if (ctl.signal.aborted) break
          failed++
          setError(`${target.label}: ${(err as Error).message || String(err)}`)
        }
        done++
      }
    } finally {
      setWireframeRun({ total: targets.length, done, failed, running: false })
      abortRef.current = null
      setBusy(false)
    }
  }, [busy, unavailableReason, aiSettings])

  // Keep the live progress feed scrolled to its newest entry.
  useEffect(() => {
    const el = progressListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [progressByStage, currentStageId])

  const handleImportHubConcept = useCallback(async (summary: HubConceptSummary) => {
    setImportingHubId(summary.id)
    setError(null)
    try {
      const concept = await loadHubConcept(summary.id)
      importHubConceptIntoDiagram(concept)
      setImportedHubIds((s) => new Set(s).add(summary.id))
    } catch (err) {
      setError((err as Error).message || String(err))
    } finally {
      setImportingHubId(null)
    }
  }, [loadHubConcept])

  const stepIndex = STEP_ORDER.indexOf(step)
  const goTo = useCallback((s: WizardStep) => { if (!busy) setStep(s) }, [busy])
  const goNext = useCallback(() => {
    const next = STEP_ORDER[stepIndex + 1]
    if (!next) return
    setStep(next)
    setReachedIndex((r) => Math.max(r, stepIndex + 1))
    setFinishedAt(null)
  }, [stepIndex])
  /** Stores the description as a `need` node before the first stage runs:
   *  a picked need gets the (possibly edited) text written back, otherwise a
   *  new need is created — and remembered, so going Back and starting again
   *  updates it instead of adding a duplicate. */
  const ensureNeed = useCallback(() => {
    if (!hasNeedType) return
    const { c4Nodes, addNode, updateNode, setActiveView } = useDiagramStore.getState()
    const text = description.trim()
    const existing = needId ? c4Nodes[needId] : undefined
    // The run's views start with the need, on Conceptual.
    const showNeed = (id: string): void => {
      const [filed] = fileIntoForgeViews(diagram, [id])
      if (filed) useDiagramStore.getState().setActiveView(filed.viewId)
    }
    if (existing) {
      if ((existing.description ?? '').trim() !== text) updateNode(existing.id, { description: text })
      showNeed(existing.id)
      return
    }
    // A new node joins the view on screen: make that Conceptual, or none yet.
    setActiveView(findForgeView(useDiagramStore.getState().views, 'conceptual')?.id ?? null)
    const def = useDiagramStore.getState().metamodel?.nodeTypes.need
    const id = addNode({
      type: 'need',
      label: needLabelFromDescription(text),
      description: text,
      kind: 'brief',
      source: 'Radical Forge',
      collapsed: false,
      x: 80,
      y: -200,
      width: def?.width ?? 200,
      height: def?.height ?? 80,
    } as Parameters<typeof addNode>[0])
    if (!id) return
    setNeedId(id)
    showNeed(id)
  }, [hasNeedType, description, needId, diagram])
  const startRun = useCallback(() => {
    ensureNeed()
    goNext()
  }, [ensureNeed, goNext])
  const goBack = useCallback(() => {
    // Back from an early finish resumes the run where it was stopped.
    if (step === 'export' && finishedAt) {
      setStep(finishedAt)
      setFinishedAt(null)
      return
    }
    const prev = STEP_ORDER[stepIndex - 1]
    if (prev) setStep(prev)
  }, [step, stepIndex, finishedAt])
  /** Explicitly end the run at the current stage — everything generated so
   *  far stays in the model; later stages (and this one, if it was never
   *  generated) are reported as skipped on the finish step. */
  const finishHere = useCallback(() => {
    if (busy || !currentStageId) return
    setFinishedAt(currentStageId)
    setStep('export')
  }, [busy, currentStageId])

  // Only while open: the dialog stays mounted, and the live layout replaces
  // c4Nodes every frame.
  const nodes = useDiagramStore((s) => (open ? s.c4Nodes : NO_NODES))
  const relations = useDiagramStore((s) => (open ? s.c4Relations : NO_RELATIONS))
  const gherkinFiles = useMemo(() => buildGherkinFiles(nodes, relations), [nodes, relations])
  const needs = useMemo(
    () => Object.values(nodes).filter((n) => n.type === 'need').sort((a, b) => a.label.localeCompare(b.label)),
    [nodes],
  )
  /** Picking a need loads its text; going back to "A new description"
   *  clears the textarea only if it still holds that need's text. */
  const pickNeed = useCallback((id: string | null) => {
    const picked = id ? nodes[id] : undefined
    const previous = needId ? nodes[needId] : undefined
    setNeedId(picked ? picked.id : null)
    if (picked) setDescription(picked.description ?? '')
    else if (previous && description === (previous.description ?? '')) setDescription('')
  }, [nodes, needId, description])
  const mockupStats = useMemo(() => {
    const mockups = Object.values(nodes).filter((n) => n.type === 'mockup')
    const missing = mockups.filter((n) => !(n as unknown as Record<string, unknown>).wireframe).length
    return { total: mockups.length, missing }
  }, [nodes])

  const isLastStage = currentStageId === FORGE_STAGES[FORGE_STAGES.length - 1].id
  // The footer is the wizard's single action bar: its right-hand side shows
  // whatever moves the current stage forward right now (answer the clarifying
  // questions → generate → continue), so the stage body only ever holds
  // per-item actions (Hub import, editing answers, wireframes, export).
  const stageAction: React.ReactNode = (() => {
    if (!currentStageId) return null
    const stageTitle = FORGE_STAGES.find((st) => st.id === currentStageId)!.title.toLowerCase()
    const clarifyStatus = clarifyStatusByStage[currentStageId]
    if (busy) {
      return <button type="button" className="forge-btn forge-btn-secondary" onClick={cancelStage}>Cancel</button>
    }
    if (clarifyStatus === 'form') {
      return (
        <>
          <button type="button" className="forge-btn forge-btn-ghost" onClick={() => skipClarify(currentStageId)}>Skip questions</button>
          <button type="button" className="forge-btn forge-btn-primary" onClick={() => submitClarify(currentStageId)}>Confirm answers</button>
        </>
      )
    }
    if (stageReports[currentStageId]) {
      return (
        <>
          <button type="button" className="forge-btn forge-btn-secondary" onClick={() => runStage(currentStageId)} disabled={!!unavailableReason || layingOut}>Regenerate</button>
          <button type="button" className="forge-btn forge-btn-primary" onClick={goNext} disabled={layingOut}>{isLastStage ? 'Finish →' : 'Continue →'}</button>
        </>
      )
    }
    return (
      <button
        type="button"
        className="forge-btn forge-btn-primary"
        onClick={() => runStage(currentStageId)}
        disabled={clarifyStatus !== 'done' || !!unavailableReason}
        title={clarifyStatus !== 'done' ? 'Checking for clarifying questions…' : undefined}
      >
        Generate {stageTitle}
      </button>
    )
  })()

  if (!open) return null

  const currentStage = FORGE_STAGES.find((s) => s.id === step)

  return createPortal(
    <div
      className="forge-panel"
      role="dialog"
      aria-label="Radical Forge"
    >
        <button
          type="button"
          className="ai-settings-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          title="Close (Esc)"
        >
          ✕
        </button>
        <div className="forge-title-row">
          <span className="forge-title-icon" aria-hidden>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 1.5 3 8l1.5 1.5L11 3z" />
              <path d="M9 3l4 4" />
              <path d="M2 14l2.5-2.5" />
              <circle cx="12.5" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <h3 className="milestone-modal-title" style={{ margin: 0 }}>Radical Forge</h3>
          {sessionUsage && (
            <span
              className="forge-session-usage"
              title={`${sessionUsage.inputTokens.toLocaleString()} input + ${sessionUsage.outputTokens.toLocaleString()} output tokens this session${sessionUsage.cachedInputTokens ? ` (${sessionUsage.cachedInputTokens.toLocaleString()} served from cache)` : ''}`}
            >
              {formatTokenCount(sessionUsage.inputTokens + sessionUsage.outputTokens)} tokens
            </span>
          )}
        </div>
        <p className="milestone-modal-text" style={{ marginBottom: 10 }}>
          Turn a free-text system description into requirements, a domain model, fitness functions,
          Gherkin scenarios, state machines, UI mockups and a C4 model — one reviewable stage at a time.
        </p>

        <div className="forge-steps" role="tablist">
          {STEP_ORDER.map((s, i) => {
            const isStage = s !== 'input' && s !== 'export'
            const done = s === 'input' ? stepIndex > 0 : isStage && !!stageReports[s as ForgeStageId]
            // Only meaningful once the run has ended: a stage that never
            // produced anything was skipped by finishing early.
            const skipped = step === 'export' && isStage && !done
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={step === s}
                className={`forge-step${step === s ? ' active' : ''}${done && step !== s ? ' done' : ''}${skipped ? ' skipped' : ''}`}
                disabled={busy || (i > reachedIndex && step !== s)}
                onClick={() => goTo(s)}
                title={skipped ? `${STEP_LABELS[s]} — skipped` : STEP_LABELS[s]}
              >
                {done && step !== s && <span className="forge-step-check" aria-hidden>✓</span>}
                {STEP_LABELS[s]}
              </button>
            )
          })}
        </div>

        {unavailableReason && (
          <div className="forge-warning">
            {unavailableReason}{' '}
            <button type="button" className="forge-btn forge-btn-secondary forge-btn-sm" onClick={openAISettings}>Configure…</button>
          </div>
        )}

        <div className="forge-body">
          {step === 'input' && (
            <>
              {hasNeedType && needs.length > 0 && (
                <label className="forge-need-picker">
                  <span>Start from</span>
                  <select
                    value={needId ?? ''}
                    onChange={(e) => pickNeed(e.target.value || null)}
                  >
                    <option value="">A new description</option>
                    {needs.map((n) => (
                      <option key={n.id} value={n.id}>{n.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <textarea
                className="forge-textarea"
                placeholder="Describe the system in plain language — who uses it, what it does, the main flows and constraints…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                autoFocus
              />
              <button type="button" className="forge-btn forge-btn-secondary forge-btn-sm" onClick={handleUpload} style={{ marginTop: 8 }}>
                Upload .txt / .md file…
              </button>
              {hasNeedType && (
                <p className="forge-need-hint">
                  {needId
                    ? 'Edits are saved back to this need, and the generated requirements are linked to it.'
                    : 'Saved in the model as a Need when you start, so every generated requirement traces back to it.'}
                </p>
              )}
            </>
          )}

          {currentStage && (
            <div className="forge-stage-card">
              <p className="milestone-modal-text" style={{ margin: '0 0 10px' }}>{currentStage.blurb}</p>

              {/* Hidden while the model picks, so the list does not change under the cursor. */}
              {!!hubMatchesByStage[currentStage.id]?.length && clarifyStatusByStage[currentStage.id] && clarifyStatusByStage[currentStage.id] !== 'asking' && (
                <div className="forge-hub-suggestions">
                  <div className="forge-hub-suggestions-label">{hubPicksByStage[currentStage.id] ? 'Picked from the Hub' : 'Suggested from the Hub'}</div>
                  {hubMatchesByStage[currentStage.id]!.map((c) => {
                    const imported = importedHubIds.has(c.id)
                    const importing = importingHubId === c.id
                    return (
                      <div key={c.id} className="forge-hub-card">
                        <div className="forge-hub-card-main">
                          <span className="forge-hub-card-name">{c.name}</span>
                          <span className="forge-hub-card-category">{c.category}</span>
                          <div className="forge-hub-card-desc">{c.description}</div>
                        </div>
                        <button
                          type="button"
                          className={`forge-btn forge-btn-sm ${imported ? 'forge-btn-success' : 'forge-btn-secondary'}`}
                          disabled={imported || importing}
                          onClick={() => handleImportHubConcept(c)}
                        >
                          {imported ? '✓ Imported' : importing ? 'Importing…' : 'Import'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {(clarifyStatusByStage[currentStage.id] === 'asking' || !clarifyStatusByStage[currentStage.id]) && (
                <div className="qs-ai-status">
                  <span className="qs-ai-dot" /> Checking for clarifying questions…
                </div>
              )}

              {clarifyStatusByStage[currentStage.id] === 'form' && (
                <div className="forge-clarify">
                  <div className="forge-clarify-label">A few quick questions before generating</div>
                  {clarifyQuestionsByStage[currentStage.id]!.map((q) => (
                    <div key={q.id} className="forge-clarify-q">
                      <label className="forge-clarify-question">{q.question}</label>
                      {q.kind === 'text' ? (
                        <input
                          type="text"
                          className="forge-clarify-input"
                          value={(clarifyAnswersByStage[currentStage.id]?.[q.id] as string) ?? ''}
                          onChange={(e) => setClarifyAnswer(currentStage.id, q.id, e.target.value)}
                        />
                      ) : (
                        <div className="forge-clarify-options">
                          {(q.options ?? []).map((opt) => {
                            const answer = clarifyAnswersByStage[currentStage.id]?.[q.id]
                            const checked = q.multiSelect
                              ? ((answer as string[] | undefined) ?? []).includes(opt)
                              : answer === opt
                            return (
                              <label key={opt} className="forge-clarify-option">
                                <input
                                  type={q.multiSelect ? 'checkbox' : 'radio'}
                                  checked={checked}
                                  onChange={() => q.multiSelect
                                    ? toggleClarifyOption(currentStage.id, q.id, opt)
                                    : setClarifyAnswer(currentStage.id, q.id, opt)}
                                />
                                {opt}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {clarifyStatusByStage[currentStage.id] === 'done' && !!clarifyQuestionsByStage[currentStage.id]?.length && !stageReports[currentStage.id] && !busy && (
                <div className="forge-clarify-summary">
                  Clarified ✓
                  <button type="button" className="forge-btn forge-btn-secondary forge-btn-sm" onClick={() => editClarify(currentStage.id)}>
                    Edit answers
                  </button>
                </div>
              )}

              {busy && !wireframeRun?.running && (() => {
                const prog = progressByStage[currentStage.id] ?? { round: 0, entries: [] }
                const createdCount = prog.entries.filter((e) => e.kind === 'action' && e.ok && e.text.startsWith('+')).length
                const failedCount = prog.entries.filter((e) => e.kind === 'action' && e.ok === false).length
                const visible = prog.entries.slice(-PROGRESS_VISIBLE_COUNT)
                return (
                  <div className="forge-progress">
                    <div className="forge-progress-header">
                      <span className="forge-progress-pulse" aria-hidden />
                      <span className="forge-progress-round">Round {prog.round || 1}</span>
                      {createdCount > 0 && <span className="forge-progress-stat">+{createdCount}</span>}
                      {failedCount > 0 && <span className="forge-progress-stat forge-progress-stat-error">{failedCount} failed</span>}
                      {prog.usage && (
                        <span className="forge-progress-stat forge-progress-stat-usage">
                          {formatTokenCount(prog.usage.inputTokens + prog.usage.outputTokens)} tok
                        </span>
                      )}
                    </div>
                    <div className="forge-progress-list" ref={progressListRef}>
                      {visible.length === 0 && (
                        <div className="forge-progress-entry forge-progress-entry-text">
                          <span className="forge-progress-dot" />
                          <span className="forge-progress-entry-text-inner">Thinking…</span>
                        </div>
                      )}
                      {visible.map((entry) => (
                        <div
                          key={entry.id}
                          className={`forge-progress-entry forge-progress-entry-${entry.kind === 'text' ? 'text' : entry.ok === false ? 'error' : 'action'}`}
                        >
                          <span className="forge-progress-dot" />
                          <span className="forge-progress-entry-text-inner">{entry.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {error && <div className="qs-ai-error">Error: {error}</div>}
              {clarifyStatusByStage[currentStage.id] !== 'form' && stageReports[currentStage.id] && !busy && (
                <div className="forge-stage-result">
                  <div className="qs-ai-text">{stageSummaries[currentStage.id]}</div>
                  <AIReportLine report={stageReports[currentStage.id]!} />
                  {progressByStage[currentStage.id]?.usage && (() => {
                    const u = progressByStage[currentStage.id]!.usage!
                    const cachedPct = u.cachedInputTokens && u.inputTokens
                      ? Math.round((u.cachedInputTokens / u.inputTokens) * 100)
                      : null
                    return (
                      <div className="forge-usage-line">
                        {formatTokenCount(u.inputTokens)} in · {formatTokenCount(u.outputTokens)} out
                        {cachedPct !== null && cachedPct > 0 && ` · ${cachedPct}% cached`}
                      </div>
                    )
                  })()}
                </div>
              )}
              {stageReports[currentStage.id] && !!arrangeByStage[currentStage.id]?.groups.length && (() => {
                const arrange = arrangeByStage[currentStage.id]!
                const alignable = arrange.groups.filter((g) => g.nodeIds.length >= 2)
                const viewNames = [...new Set(arrange.groups.map((g) => g.viewName))].join(' and ')
                return (
                  <div className="forge-arrange">
                    <div className="forge-arrange-title">Arrange</div>
                    {alignable.length > 0 && (
                      <div className="forge-arrange-row">
                        <span>
                          Keep the {alignable.map((g) => `${g.nodeIds.length} new elements on ${g.viewName}`).join(' and ')} in a
                        </span>
                        {FORGE_ARRANGEMENTS.map((arrangement) => (
                          <button
                            key={arrangement}
                            type="button"
                            className={`forge-btn forge-btn-sm ${arrange.arranged === arrangement ? 'forge-btn-success' : 'forge-btn-secondary'}`}
                            disabled={busy || layingOut || !!arrange.arranged}
                            onClick={() => arrangeStage(currentStage.id, arrangement)}
                          >
                            {arrange.arranged === arrangement ? `✓ ${ARRANGEMENT_LABELS[arrangement]}` : ARRANGEMENT_LABELS[arrangement]}
                          </button>
                        ))}
                        <span>?</span>
                      </div>
                    )}
                    <div className="forge-arrange-row">
                      <span>Run Smart Layout on {viewNames}?</span>
                      <button
                        type="button"
                        className={`forge-btn forge-btn-sm ${arrange.laidOut ? 'forge-btn-success' : 'forge-btn-secondary'}`}
                        disabled={busy || layingOut}
                        onClick={() => void layoutStage(currentStage.id)}
                      >
                        {layingOut ? 'Laying out…' : arrange.laidOut ? '✓ Smart Layout' : 'Smart Layout'}
                      </button>
                    </div>
                    {arrange.message && (
                      <div className={`forge-arrange-message${arrange.failed ? ' forge-arrange-message-error' : ''}`}>{arrange.message}</div>
                    )}
                  </div>
                )
              })()}
              {currentStage.id === 'mockups' && stageReports.mockups && mockupStats.total > 0 && (
                <div className="forge-wireframes">
                  <div className="forge-wireframes-title">Wireframes</div>
                  {wireframeRun?.running ? (
                    <div className="forge-wireframes-row">
                      <span className="forge-progress-pulse" aria-hidden />
                      <span>
                        Drawing {Math.min(wireframeRun.done + 1, wireframeRun.total)}/{wireframeRun.total}
                        {wireframeRun.current ? ` — ${wireframeRun.current}` : ''}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="forge-wireframes-row">
                        {mockupStats.missing === 0
                          ? `All ${mockupStats.total} mockup${mockupStats.total === 1 ? ' has' : 's have'} a wireframe.`
                          : `${mockupStats.missing} of ${mockupStats.total} mockup${mockupStats.total === 1 ? '' : 's'} without a wireframe.`}
                        {wireframeRun && wireframeRun.failed > 0 && ` ${wireframeRun.failed} failed.`}
                      </div>
                      {mockupStats.missing > 0 && !busy && (
                        <button
                          type="button"
                          className="forge-btn forge-btn-primary forge-btn-sm"
                          onClick={() => void generateMissingWireframes()}
                          disabled={!!unavailableReason}
                        >
                          ✨ Generate {mockupStats.missing} wireframe{mockupStats.missing === 1 ? '' : 's'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'export' && (
            <div className="forge-stage-card">
              <p className="milestone-modal-text" style={{ margin: '0 0 8px' }}>
                {finishedAt
                  ? `Run finished early at ${FORGE_STAGES.find((st) => st.id === finishedAt)!.title.toLowerCase()}. Everything generated so far stays in the model — use ← Back to resume.`
                  : 'All stages done.'}
              </p>
              <ul className="forge-finish-summary">
                {FORGE_STAGES.map((st) => {
                  const report = stageReports[st.id]
                  return (
                    <li key={st.id} className={report ? '' : 'forge-finish-skipped'}>
                      <span className="forge-finish-stage">{st.title}</span>
                      <span className="forge-finish-result">
                        {report
                          ? `+${report.added.nodes} node${report.added.nodes === 1 ? '' : 's'} · +${report.added.relations} relation${report.added.relations === 1 ? '' : 's'}`
                          : 'skipped'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="milestone-modal-text" style={{ margin: '0 0 10px' }}>
                {gherkinFiles.length > 0
                  ? `Ready to export ${gherkinFiles.length} .feature file${gherkinFiles.length === 1 ? '' : 's'} from the scenarios in this model.`
                  : 'No Gherkin scenarios in the model yet — go back to the Scenarios step to generate some, or add them manually on the canvas.'}
              </p>
              {gherkinFiles.length > 0 && (
                <button type="button" className="forge-btn forge-btn-primary" onClick={() => downloadGherkinFiles(gherkinFiles)}>
                  Export .feature files
                </button>
              )}
            </div>
          )}
        </div>

        <div className="milestone-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="forge-btn forge-btn-secondary" onClick={goBack} disabled={busy || stepIndex === 0}>
            ← Back
          </button>
          {step === 'export' ? (
            <button type="button" className="forge-btn forge-btn-primary" onClick={onClose}>Done</button>
          ) : !currentStage ? (
            <button
              type="button"
              className="forge-btn forge-btn-primary"
              onClick={startRun}
              disabled={!description.trim()}
            >
              Start →
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {!(isLastStage && stageReports[currentStage.id]) && (
                <button
                  type="button"
                  className="forge-btn forge-btn-ghost"
                  onClick={finishHere}
                  disabled={busy}
                  title={busy ? 'Cancel the running step first' : 'End the run here — keep what has been generated and skip the remaining stages'}
                >
                  Finish here
                </button>
              )}
              {stageAction}
            </div>
          )}
        </div>
    </div>,
    document.body,
  )
}
