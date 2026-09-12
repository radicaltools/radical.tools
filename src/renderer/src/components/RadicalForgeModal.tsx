import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDiagramStore } from '../store/diagramStore'
import { runAIPrompt, type ForgeProgressEvent } from '../ai/runner'
import { loadAISettings } from '../ai/settings'
import { getAdapter } from '../ai/registry'
import { useDiagramFacade } from '../ai/useDiagramFacade'
import { FORGE_STAGES, PRIMARY_TYPE_IDS_FOR_STAGE, buildForgeStagePrompt, buildPriorStagesBlock, type ForgeStageId } from '../ai/forgePrompts'
import { buildGherkinFiles, downloadGherkinFiles } from '../export/exportGherkin'
import { AIReportLine } from './AIReportLine'
import { useHubStore, type HubCategory, type HubConceptSummary } from '../store/hubStore'
import { findRelevantConcepts } from '../hub/matchConcepts'
import { importHubConceptIntoDiagram } from '../hub/importConcept'
import {
  askClarifyingQuestions,
  formatClarificationAnswers,
  HUB_MATCHES_QUESTION_ID,
  type ClarifyStageQuestion,
} from '../ai/forgeClarify'
import { addTokenUsage, type AISettings, type TokenUsage } from '../ai/types'
import type { ApplyReport } from '../ai/diagramFacade'

type ClarifyStatus = 'asking' | 'form' | 'done'
type ClarifyAnswers = Record<string, string | string[]>

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

/** Hub categories worth surfacing as prior art for each stage — the C4 stage
 *  is where decomposition/coupling guidance (patterns, ADRs) matters most.
 *  `scenarios` has no matching Hub category (no Gherkin content there). */
const HUB_CATEGORIES_FOR_STAGE: Partial<Record<ForgeStageId, HubCategory[]>> = {
  requirements: ['requirement'],
  c4: ['pattern', 'adr'],
  fitness: ['fitness-function'],
}

/** Requirements tagged this way are generic, domain-agnostic engineering
 *  tenets (idempotency, least privilege, resource isolation, ...) rather
 *  than product-specific behaviour — a "principle" is modeled as a kind of
 *  requirement (a tag), not a new concept type. The C4 stage treats them as
 *  decomposition guidance alongside patterns/ADRs. */
const PRINCIPLE_TAG = 'principle'
const PRINCIPLE_MATCH_LIMIT = 2

interface Props {
  open: boolean
  onClose: () => void
}

type WizardStep = 'input' | ForgeStageId | 'export'

const STEP_ORDER: WizardStep[] = ['input', ...FORGE_STAGES.map((s) => s.id), 'export']
const STEP_LABELS: Record<WizardStep, string> = {
  input: 'Description',
  requirements: 'Requirements',
  c4: 'C4 model',
  fitness: 'Fitness fns',
  scenarios: 'Scenarios',
  export: 'Export',
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

export function RadicalForgeModal({ open, onClose }: Props): React.ReactElement | null {
  const [step, setStep] = useState<WizardStep>('input')
  const [description, setDescription] = useState('')
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
  const progressIdRef = useRef(0)
  const progressListRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Stages the clarify effect below has already started for this wizard run
  // — a ref, not state, so starting a fetch doesn't itself change an effect
  // dependency (see the effect for why that would matter).
  const clarifyStartedRef = useRef<Set<ForgeStageId>>(new Set())
  const diagram = useDiagramFacade()

  const currentStageId: ForgeStageId | null = FORGE_STAGES.some((s) => s.id === step) ? (step as ForgeStageId) : null

  const hubConcepts = useHubStore((s) => s.concepts)
  const fetchHubConcepts = useHubStore((s) => s.fetchConcepts)
  const loadHubConcept = useHubStore((s) => s.loadConcept)
  const activeMetamodelId = useDiagramStore((s) => s.metamodel?.id)

  // Reset to a clean run every time the wizard is (re)opened.
  useEffect(() => {
    if (!open) return
    setStep('input')
    setDescription('')
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
    clarifyStartedRef.current = new Set()
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

  const providerCfg = aiSettings.providers[aiSettings.active]
  const providerLabel = getAdapter(aiSettings.active).label
  const needsKey = aiSettings.active !== 'ollama' && !providerCfg.apiKey
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

  const hubMatchesByStage = useMemo(() => {
    const out: Partial<Record<ForgeStageId, HubConceptSummary[]>> = {}
    if (!description.trim()) return out
    for (const stage of FORGE_STAGES) {
      const categories = HUB_CATEGORIES_FOR_STAGE[stage.id]
      if (categories) out[stage.id] = findRelevantConcepts(hubConcepts, categories, description, activeMetamodelId)
    }
    // Decomposition guidance for the C4 stage also draws on "principle"-tagged
    // requirements (see PRINCIPLE_TAG above) — searched separately so they
    // don't get crowded out by the (much larger) pattern/adr pool.
    const principleReqs = hubConcepts.filter((c) => c.category === 'requirement' && c.tags.includes(PRINCIPLE_TAG))
    const principleMatches = findRelevantConcepts(principleReqs, 'requirement', description, activeMetamodelId, PRINCIPLE_MATCH_LIMIT)
    if (principleMatches.length) out.c4 = [...(out.c4 ?? []), ...principleMatches]
    return out
  }, [hubConcepts, description, activeMetamodelId])

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
  // stageReports/unavailableReason/description/hubMatchesByStage/aiSettings
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
    askClarifyingQuestions(stage.title, description, hubMatchesByStage[currentStageId], aiSettings, undefined, priorQA)
      .then(({ questions, usage }) => {
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
      const prompt = buildForgeStagePrompt(stageId, description, effectiveMatches, clarifications, priorStageSummaries)
      const relevantTypeIds = new Set(PRIMARY_TYPE_IDS_FOR_STAGE[stageId])
      const result = await runAIPrompt({ prompt, settings: aiSettings, diagram, signal: ctl.signal, onProgress, relevantTypeIds })
      setStageReports((r) => ({ ...r, [stageId]: result.report }))
      setStageSummaries((s) => ({ ...s, [stageId]: result.summary || 'Done.' }))
      if (result.usage) {
        setProgressByStage((p) => ({ ...p, [stageId]: { ...(p[stageId] ?? { round: 0, entries: [] }), usage: result.usage } }))
        setSessionUsage((u) => addTokenUsage(u, result.usage))
      }
    } catch (err) {
      setError((err as Error).message || String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }, [busy, unavailableReason, description, hubMatchesByStage, clarifyAnswersByStage, clarifyQuestionsByStage, aiSettings, diagram, stageSummaries])

  const cancelStage = useCallback(() => { abortRef.current?.abort() }, [])

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
    if (next) setStep(next)
  }, [stepIndex])
  const goBack = useCallback(() => {
    const prev = STEP_ORDER[stepIndex - 1]
    if (prev) setStep(prev)
  }, [stepIndex])

  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const gherkinFiles = useMemo(() => buildGherkinFiles(nodes, relations), [nodes, relations])

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
          Turn a free-text system description into requirements, a C4 model, fitness
          functions and Gherkin scenarios — one reviewable stage at a time.
        </p>

        <div className="forge-steps" role="tablist">
          {STEP_ORDER.map((s, i) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={step === s}
              className={`forge-step${step === s ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
              disabled={i > stepIndex || busy}
              onClick={() => goTo(s)}
              title={STEP_LABELS[s]}
            >
              {i < stepIndex && <span className="forge-step-check" aria-hidden>✓</span>}
              {STEP_LABELS[s]}
            </button>
          ))}
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
            </>
          )}

          {currentStage && (
            <div className="forge-stage-card">
              <p className="milestone-modal-text" style={{ margin: '0 0 10px' }}>{currentStage.blurb}</p>

              {!!hubMatchesByStage[currentStage.id]?.length && (
                <div className="forge-hub-suggestions">
                  <div className="forge-hub-suggestions-label">Suggested from the Hub</div>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {/* Deliberately NOT labeled "Continue" — that's the
                        footer button's job (advancing to the next wizard
                        step once this stage has generated). This one only
                        confirms the answers above and reveals the Generate
                        button for the current stage. */}
                    <button type="button" className="forge-btn forge-btn-primary" onClick={() => submitClarify(currentStage.id)}>
                      Confirm answers
                    </button>
                    <button type="button" className="forge-btn forge-btn-ghost" onClick={() => skipClarify(currentStage.id)}>
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {clarifyStatusByStage[currentStage.id] === 'done' && !!clarifyQuestionsByStage[currentStage.id]?.length && !stageReports[currentStage.id] && (
                <div className="forge-clarify-summary">
                  Clarified ✓
                  <button type="button" className="forge-btn forge-btn-secondary forge-btn-sm" onClick={() => editClarify(currentStage.id)}>
                    Edit answers
                  </button>
                </div>
              )}

              {clarifyStatusByStage[currentStage.id] === 'done' && !stageReports[currentStage.id] && !busy && (
                <button
                  type="button"
                  className="forge-btn forge-btn-primary"
                  onClick={() => runStage(currentStage.id)}
                  disabled={!!unavailableReason}
                >
                  Generate {currentStage.title.toLowerCase()}
                </button>
              )}
              {busy && (() => {
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
                      <span className="forge-progress-spacer" />
                      <button type="button" className="forge-btn forge-btn-ghost forge-btn-sm" onClick={cancelStage}>Cancel</button>
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
                  <button
                    type="button"
                    className="forge-btn forge-btn-secondary forge-btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => runStage(currentStage.id)}
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'export' && (
            <div className="forge-stage-card">
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
          ) : (
            <button
              type="button"
              className={`forge-btn ${step === 'input' ? 'forge-btn-primary' : 'forge-btn-secondary'}`}
              onClick={goNext}
              disabled={
                busy
                || (step === 'input' && !description.trim())
                || (!!currentStage && !stageReports[currentStage.id])
              }
            >
              {step === 'input' ? 'Start →' : 'Continue →'}
            </button>
          )}
        </div>
    </div>,
    document.body,
  )
}
