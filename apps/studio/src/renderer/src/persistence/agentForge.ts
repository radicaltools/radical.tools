// ─── Agent Forge run → Studio ────────────────────────────────────────────────
//
// An agent running Radical Forge over MCP on the same model folder writes
// where the run stands to `.radical/forge-run.json` (see forgeRunStatus).
// This polls that file for the active md-folder document so the Forge button
// can pulse and open a read-only view of the run. Nothing here talks back to
// the agent.

import { create } from 'zustand'
import { forgeRunPhase, parseForgeRun, FORGE_RUN_STALE_MS, type ForgeRunPhase, type ForgeRunStatus } from '@radical/common/formats/forgeRunStatus'
import { documents, useDocumentsStore } from '../store/documentStore'

const POLL_MS = 2000

interface AgentForgeState {
  /** The run on the active document's folder, when there is one. */
  status: ForgeRunStatus | null
}

export const useAgentForgeStore = create<AgentForgeState>(() => ({ status: null }))

/** How the Forge button shows a run: null when there is nothing worth
 *  showing (no run, or one that ended over FORGE_RUN_STALE_MS ago). */
export function agentForgePhase(status: ForgeRunStatus | null, now = Date.now()): ForgeRunPhase | null {
  if (!status) return null
  const phase = forgeRunPhase(status, now)
  if ((phase === 'done' || phase === 'paused') && now - Date.parse(status.updatedAt) > FORGE_RUN_STALE_MS) return null
  return phase
}

if (typeof window !== 'undefined') {
  let polledFor: string | null = null
  let last = ''

  const poll = async (): Promise<void> => {
    const id = documents.getActiveId()
    if (id !== polledFor) {
      polledFor = id
      last = ''
      useAgentForgeStore.setState({ status: null })
    }
    if (!id) return
    const text = await documents.readForgeRun(id).catch(() => null)
    if (documents.getActiveId() !== id || (text ?? '') === last) return
    last = text ?? ''
    useAgentForgeStore.setState({ status: text ? parseForgeRun(text) : null })
  }

  setInterval(() => { void poll() }, POLL_MS)
  useDocumentsStore.subscribe((s) => { if (s.activeId !== polledFor) void poll() })
  void poll()
}
