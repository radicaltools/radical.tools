// ─── Agent Assay run → Studio ────────────────────────────────────────────────
//
// An agent running Radical Assay over MCP with this model folder as its
// central model writes where the run stands to `.state/assay-run.json` (see
// assayRunStatus). This polls that file for the active md-folder document so
// an Assay button can show beside the Forge button, pulse, and open a
// read-only view of the run (ADR Agent Assay runs show in Studio). Studio
// cannot run Assay itself: only the agent reads the code's directories.
// Nothing here talks back to the agent.

import { create } from 'zustand'
import { assayRunPhase, parseAssayRun, ASSAY_RUN_STALE_MS, type AssayRunPhase, type AssayRunStatus } from '@radical/common/formats/assayRunStatus'
import { documents, useDocumentsStore } from '../store/documentStore'

const POLL_MS = 2000

interface AgentAssayState {
  /** The run on the active document's folder, when there is one. */
  status: AssayRunStatus | null
}

export const useAgentAssayStore = create<AgentAssayState>(() => ({ status: null }))

/** How the Assay button shows a run: null when there is nothing worth
 *  showing (no run, or one that ended over ASSAY_RUN_STALE_MS ago), and then
 *  there is no Assay button. */
export function agentAssayPhase(status: AssayRunStatus | null, now = Date.now()): AssayRunPhase | null {
  if (!status) return null
  const phase = assayRunPhase(status, now)
  if ((phase === 'done' || phase === 'paused') && now - Date.parse(status.updatedAt) > ASSAY_RUN_STALE_MS) return null
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
      useAgentAssayStore.setState({ status: null })
    }
    if (!id) return
    const text = await documents.readAssayRun(id).catch(() => null)
    if (documents.getActiveId() !== id || (text ?? '') === last) return
    last = text ?? ''
    useAgentAssayStore.setState({ status: text ? parseAssayRun(text) : null })
  }

  setInterval(() => { void poll() }, POLL_MS)
  useDocumentsStore.subscribe((s) => { if (s.activeId !== polledFor) void poll() })
  void poll()
}
