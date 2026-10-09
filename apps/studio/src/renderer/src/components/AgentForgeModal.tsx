import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FORGE_STAGES } from '@radical/common/ai/forge'
import { forgeRunClientName, forgeRunCurrentStage, forgeRunPhase, type ForgeRunStageInfo } from '@radical/common/formats/forgeRunStatus'
import { useAgentForgeStore } from '../persistence/agentForge'
import { STEP_LABELS } from './RadicalForgeModal'

// ─── An agent's Forge run, read only ─────────────────────────────────────────
// What an agent running Radical Forge over MCP on this folder is doing: the
// wizard's step bar with each stage's state, and one line on where the run
// stands. Nothing here acts on the run; the agent's chat is where to answer.

interface Props {
  open: boolean
  onClose: () => void
}

const stageTitle = (id: string): string => FORGE_STAGES.find((s) => s.id === id)?.title ?? id

function stageTip(stage: ForgeRunStageInfo): string {
  const title = stageTitle(stage.id)
  if (stage.status === 'done') {
    const added = stage.added ? ` (+${stage.added.nodes} elements, +${stage.added.relations} relations)` : ''
    return `${title}: done${added}${stage.summary ? ` — ${stage.summary}` : ''}`
  }
  if (stage.status === 'generating') return `${title}: generating`
  if (stage.status === 'clarifying') return `${title}: asking you a few questions`
  return `${title}: not started`
}

export function AgentForgeModal({ open, onClose }: Props): React.ReactElement | null {
  const status = useAgentForgeStore((s) => s.status)
  // Re-render now and then so a run that goes quiet shows as paused.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(timer)
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !status) return null
  const phase = forgeRunPhase(status, now)
  const client = forgeRunClientName(status.client)
  const current = forgeRunCurrentStage(status)
  const line =
    phase === 'done' ? 'Finished.'
    : phase === 'paused' ? (status.state === 'closed' ? `Stopped: ${client} closed before the run finished.` : 'Paused: nothing has changed for 30 minutes.')
    : current?.status === 'generating' ? `${client} is generating the ${stageTitle(current.id)} stage…`
    : current?.status === 'clarifying' ? `${client} is asking you about the ${stageTitle(current.id)} stage; answer there.`
    : current && status.stages.some((s) => s.status === 'done') ? `Waiting for you in ${client}: how to arrange the last stage, and whether to go on to ${stageTitle(current.id)}.`
    : current ? `${client} has started the run; next is the ${stageTitle(current.id)} stage.`
    : `Waiting for you in ${client}.`

  return createPortal(
    <div className="forge-panel" role="dialog" aria-label="Radical Forge — agent run">
      <button type="button" className="ai-settings-close" onClick={onClose} aria-label="Close" title="Close (Esc)">✕</button>
      <div className="forge-title-row">
        <span className="forge-title-icon" aria-hidden>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 1.5 3 8l1.5 1.5L11 3z" />
            <path d="M9 3l4 4" />
            <path d="M2 14l2.5-2.5" />
            <circle cx="12.5" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <h3 className="milestone-modal-title" style={{ margin: 0 }}>Radical Forge — run by {client}</h3>
      </div>
      {status.need && <p className="milestone-modal-text" style={{ marginBottom: 10 }}>{status.need.label}</p>}

      <div className="forge-steps" role="list">
        <span className="forge-step done" role="listitem" title="Description: kept as a need"><span className="forge-step-check" aria-hidden>✓</span>{STEP_LABELS.input}</span>
        {status.stages.map((stage) => {
          const active = stage === current && phase !== 'done' && phase !== 'paused'
          return (
            <span
              key={stage.id}
              role="listitem"
              data-status={stage.status}
              className={`forge-step${stage.status === 'done' ? ' done' : ''}${active ? ' active' : ''}${stage.status === 'clarifying' ? ' waiting' : ''}`}
              title={stageTip(stage)}
            >
              {stage.status === 'done' && <span className="forge-step-check" aria-hidden>✓</span>}
              {STEP_LABELS[stage.id]}
            </span>
          )
        })}
        <span className={`forge-step${status.state === 'finished' ? ' done' : ''}`} role="listitem" title="Finish">
          {status.state === 'finished' && <span className="forge-step-check" aria-hidden>✓</span>}
          {STEP_LABELS.export}
        </span>
      </div>
      <p className="milestone-modal-text forge-agent-line" data-phase={phase}>{line}</p>
    </div>,
    document.body,
  )
}
