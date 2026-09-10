import React from 'react'
import type { ApplyReport } from '../ai/diagramFacade'

/** Compact one-line summary of an AI run's `ApplyReport` — "+3 nodes,
 *  +2 relations" etc. — plus any tool errors. Shared by every AI entry point
 *  that surfaces `runAIPrompt` results (QuickSearch's ✨ chat, Radical Forge). */
export function AIReportLine({ report }: { report: ApplyReport }): React.ReactElement {
  const parts: string[] = []
  if (report.added.nodes) parts.push(`+${report.added.nodes} node${report.added.nodes === 1 ? '' : 's'}`)
  if (report.added.relations) parts.push(`+${report.added.relations} relation${report.added.relations === 1 ? '' : 's'}`)
  if (report.added.views) parts.push(`+${report.added.views} view${report.added.views === 1 ? '' : 's'}`)
  if (report.updated.nodes) parts.push(`~${report.updated.nodes} updated`)
  if (report.updated.relations) parts.push(`~${report.updated.relations} relation${report.updated.relations === 1 ? '' : 's'} updated`)
  if (report.updated.views) parts.push(`~${report.updated.views} view${report.updated.views === 1 ? '' : 's'}`)
  if (report.deleted.nodes) parts.push(`−${report.deleted.nodes} node${report.deleted.nodes === 1 ? '' : 's'}`)
  if (report.deleted.relations) parts.push(`−${report.deleted.relations} relation${report.deleted.relations === 1 ? '' : 's'}`)
  if (report.deleted.views) parts.push(`−${report.deleted.views} view${report.deleted.views === 1 ? '' : 's'}`)
  return (
    <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
      {parts.length ? parts.join(' · ') : 'No changes'}
      {report.errors.length > 0 && (
        <div style={{ color: '#ff8888', marginTop: 2 }}>
          {report.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}
    </div>
  )
}
