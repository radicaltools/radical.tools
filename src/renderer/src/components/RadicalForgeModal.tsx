import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDiagramStore } from '../store/diagramStore'
import { runAIPrompt } from '../ai/runner'
import { loadAISettings } from '../ai/settings'
import { getAdapter } from '../ai/registry'
import { useDiagramFacade } from '../ai/useDiagramFacade'
import { FORGE_STAGES, buildForgeStagePrompt, type ForgeStageId } from '../ai/forgePrompts'
import { buildGherkinFiles, downloadGherkinFiles } from '../export/exportGherkin'
import { AIReportLine } from './AIReportLine'
import { useHubStore, type HubCategory, type HubConceptSummary } from '../store/hubStore'
import { findRelevantConcepts } from '../hub/matchConcepts'
import { importHubConceptIntoDiagram } from '../hub/importConcept'
import type { AISettings, ChatMessage } from '../ai/types'
import type { ApplyReport } from '../ai/diagramFacade'

/** Hub categories worth surfacing as prior art for each stage — the C4 stage
 *  is where decomposition/coupling guidance (patterns, ADRs) matters most.
 *  `scenarios` has no matching Hub category (no Gherkin content there). */
const HUB_CATEGORIES_FOR_STAGE: Partial<Record<ForgeStageId, HubCategory[]>> = {
  requirements: ['requirement'],
  c4: ['pattern', 'adr'],
  fitness: ['fitness-function'],
}

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
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [stageReports, setStageReports] = useState<Partial<Record<ForgeStageId, ApplyReport>>>({})
  const [stageSummaries, setStageSummaries] = useState<Partial<Record<ForgeStageId, string>>>({})
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadAISettings())
  const [importedHubIds, setImportedHubIds] = useState<Set<string>>(new Set())
  const [importingHubId, setImportingHubId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const diagram = useDiagramFacade()

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
    setHistory([])
    setStageReports({})
    setStageSummaries({})
    setAiSettings(loadAISettings())
    setImportedHubIds(new Set())
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
    return out
  }, [hubConcepts, description, activeMetamodelId])

  const runStage = useCallback(async (stageId: ForgeStageId) => {
    if (busy || unavailableReason) return
    setBusy(true)
    setError(null)
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      const prompt = buildForgeStagePrompt(stageId, description, hubMatchesByStage[stageId])
      const result = await runAIPrompt({ prompt, settings: aiSettings, diagram, history, signal: ctl.signal })
      setHistory((h) => [...h, ...result.history])
      setStageReports((r) => ({ ...r, [stageId]: result.report }))
      setStageSummaries((s) => ({ ...s, [stageId]: result.summary || 'Done.' }))
    } catch (err) {
      setError((err as Error).message || String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }, [busy, unavailableReason, description, hubMatchesByStage, aiSettings, diagram, history])

  const cancelStage = useCallback(() => { abortRef.current?.abort() }, [])

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
      className="milestone-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        const start = e.currentTarget
        const onUp = (ev: MouseEvent): void => {
          window.removeEventListener('mouseup', onUp, true)
          if (ev.target === start && !busy) onClose()
        }
        window.addEventListener('mouseup', onUp, true)
      }}
    >
      <div
        className="milestone-modal forge-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
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
        <h3 className="milestone-modal-title">Radical Forge</h3>
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
              {STEP_LABELS[s]}
            </button>
          ))}
        </div>

        {unavailableReason && (
          <div className="forge-warning">
            {unavailableReason}{' '}
            <button type="button" className="qs-ai-mini-btn" onClick={openAISettings}>Configure…</button>
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
              <button type="button" className="qs-ai-mini-btn" onClick={handleUpload} style={{ marginTop: 8 }}>
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
                          className="qs-ai-mini-btn"
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

              {!stageReports[currentStage.id] && !busy && (
                <button
                  type="button"
                  className="forge-primary-btn"
                  onClick={() => runStage(currentStage.id)}
                  disabled={!!unavailableReason}
                >
                  Generate {currentStage.title.toLowerCase()}
                </button>
              )}
              {busy && (
                <div className="qs-ai-status">
                  <span className="qs-ai-dot" /> Generating…
                  <button type="button" className="qs-ai-mini-btn" onClick={cancelStage}>Cancel</button>
                </div>
              )}
              {error && <div className="qs-ai-error">Error: {error}</div>}
              {stageReports[currentStage.id] && !busy && (
                <div className="forge-stage-result">
                  <div className="qs-ai-text">{stageSummaries[currentStage.id]}</div>
                  <AIReportLine report={stageReports[currentStage.id]!} />
                  <button
                    type="button"
                    className="qs-ai-mini-btn"
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
                <button type="button" className="forge-primary-btn" onClick={() => downloadGherkinFiles(gherkinFiles)}>
                  Export .feature files
                </button>
              )}
            </div>
          )}
        </div>

        <div className="milestone-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="qs-ai-mini-btn" onClick={goBack} disabled={busy || stepIndex === 0}>
            ← Back
          </button>
          {step === 'export' ? (
            <button type="button" className="forge-primary-btn" onClick={onClose}>Done</button>
          ) : (
            <button
              type="button"
              className="qs-ai-mini-btn"
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
      </div>
    </div>,
    document.body,
  )
}
