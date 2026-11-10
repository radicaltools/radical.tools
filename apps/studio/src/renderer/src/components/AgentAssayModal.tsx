import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ASSAY_STAGES, assayRunCurrentStage, assayRunPhase, type AssayRunStageInfo, type AssayRunStatus } from '@radical/common/formats/assayRunStatus'
import { forgeRunClientName } from '@radical/common/formats/forgeRunStatus'
import { useAgentAssayStore } from '../persistence/agentAssay'
import { setFollowAgent, useFollowAgentStore } from '../persistence/followAgent'

// ─── An agent's Assay run, read only ─────────────────────────────────────────
// What an agent running Radical Assay over MCP with this folder as its
// central model is doing: Assay's stages as a step bar (the server infers
// them from the agent's calls, ADR Agent Assay runs show in Studio), the
// repositories it read, the plans the server wrote and refused, and the
// proposals waiting for the user. Nothing here acts on the run; the agent's
// chat is where to answer. Follow on the canvas works as for Forge.

interface Props {
  open: boolean
  onClose: () => void
}

const stageTitle = (id: string): string => ASSAY_STAGES.find((s) => s.id === id)?.title ?? id
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

function stageTip(stage: AssayRunStageInfo): string {
  const title = stageTitle(stage.id)
  const counts = [
    ...(stage.plans ? [`${plural(stage.plans, 'plan')} written`] : []),
    ...(stage.refused ? [`${stage.refused} refused`] : []),
    ...(stage.added ? [`+${stage.added.nodes} elements, +${stage.added.relations} relations`] : []),
  ].join(', ')
  const state = stage.status === 'working' ? 'the stage the run is at'
    : stage.status === 'done' ? 'done'
    : stage.status === 'skipped' ? 'skipped (the run moved past it with no plan)'
    : 'not reached'
  return `${title}: ${state}${counts ? ` (${counts})` : ''}`
}

/** The run's repositories, briefly: their names with their units, and the sources of documents. */
function repositoriesLine(status: AssayRunStatus): string {
  const repos = status.repositories
  const shown = repos.slice(0, 4).map((r) => `${r.name} (${plural(r.units, 'unit')})`).join(', ')
  const more = repos.length > 4 ? ` and ${repos.length - 4} more` : ''
  const sources = status.sources ? ` · ${plural(status.sources, 'source')} of documents` : ''
  return `${plural(repos.length, 'repository', 'repositories')}: ${shown}${more}${sources}`
}

export function AgentAssayModal({ open, onClose }: Props): React.ReactElement | null {
  const status = useAgentAssayStore((s) => s.status)
  const following = useFollowAgentStore((s) => s.on)
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
  const phase = assayRunPhase(status, now)
  const client = forgeRunClientName(status.client)
  const current = assayRunCurrentStage(status)
  const waiting = status.proposals.waiting
  const line =
    phase === 'done' ? (waiting ? `Finished; ${plural(waiting, 'proposal')} still wait for your answer in ${client}.` : 'Finished.')
    : phase === 'paused' ? (status.state === 'closed' ? `Stopped: ${client} closed before the run finished.` : 'Paused: nothing has changed for 30 minutes.')
    : phase === 'waiting' ? `${client} waits for your answer to ${plural(waiting, 'proposal')}${current ? ` of the ${stageTitle(current.id)} stage` : ''}; answer there.`
    : current ? `${client} is working on the ${stageTitle(current.id)} stage…`
    : `${client} has started the run.`
  const plans = status.stages.reduce((n, s) => n + (s.plans ?? 0), 0)
  const refused = status.stages.reduce((n, s) => n + (s.refused ?? 0), 0)
  const nodes = status.stages.reduce((n, s) => n + (s.added?.nodes ?? 0), 0)
  const relations = status.stages.reduce((n, s) => n + (s.added?.relations ?? 0), 0)
  const { accepted, rejected } = status.proposals

  return createPortal(
    <div className="forge-panel" role="dialog" aria-label="Radical Assay — agent run">
      <button type="button" className="ai-settings-close" onClick={onClose} aria-label="Close" title="Close (Esc)">✕</button>
      <div className="forge-title-row">
        <span className="forge-title-icon" aria-hidden><AssayIcon /></span>
        <h3 className="milestone-modal-title" style={{ margin: 0 }}>Radical Assay — run by {client}</h3>
      </div>
      <p className="milestone-modal-text" style={{ marginBottom: 10 }} data-testid="assay-run-repositories">{repositoriesLine(status)}</p>

      <div className="forge-steps" role="list">
        {status.stages.map((stage) => {
          const active = stage === current && (phase === 'working' || phase === 'waiting') && stage.status === 'working'
          return (
            <span
              key={stage.id}
              role="listitem"
              data-status={stage.status}
              className={`forge-step${stage.status === 'done' ? ' done' : ''}${stage.status === 'skipped' ? ' skipped' : ''}${active ? ' active' : ''}${active && phase === 'waiting' ? ' waiting' : ''}`}
              title={stageTip(stage)}
            >
              {stage.status === 'done' && <span className="forge-step-check" aria-hidden>✓</span>}
              {ASSAY_STAGES.find((s) => s.id === stage.id)?.short ?? stage.id}
              {!!stage.refused && (
                <span className="forge-step-refined pending" data-testid="assay-step-refused" aria-label={`${plural(stage.refused, 'plan')} refused`}>↺{stage.refused}</span>
              )}
            </span>
          )
        })}
      </div>
      <p className="milestone-modal-text forge-agent-line" data-phase={phase}>{line}</p>
      <p className="milestone-modal-text assay-agent-counts" data-testid="assay-run-counts">
        {plural(plans, 'plan')} written{refused ? `, ${refused} refused` : ''} · +{plural(nodes, 'element')}, +{plural(relations, 'relation')}
        {' · '}Proposals: {waiting} waiting, {accepted} accepted, {rejected} left out
      </p>
      {(phase === 'working' || phase === 'waiting') && (
        <div className="forge-agent-follow">
          <button
            type="button"
            className={`forge-btn forge-btn-sm ${following ? 'forge-btn-secondary' : 'forge-btn-primary'}`}
            aria-pressed={following}
            onClick={() => {
              setFollowAgent(!following)
              // The canvas is where to look now.
              if (!following) onClose()
            }}
          >
            {following ? 'Stop following' : 'Follow on the canvas'}
          </button>
          <span className="forge-agent-follow-hint">
            Opens the view {client} writes to and frames what it adds. Move the camera or open another view yourself and it waits for {client}'s next turn.
          </span>
        </div>
      )}
    </div>,
    document.body,
  )
}

/** Assay's mark: a flask. */
export function AssayIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5h4" />
      <path d="M6.75 1.5v4L3 12.5a1.3 1.3 0 0 0 1.15 2h7.7a1.3 1.3 0 0 0 1.15-2L9.25 5.5v-4" />
      <path d="M4.6 10h6.8" />
    </svg>
  )
}
