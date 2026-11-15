// ─── Inspector settings ──────────────────────────────────────────────────────
//
// The open model's check.json (with the test files .radical/radical.json
// names): the goals, the rules' severities and baselines and the test files
// test-unbound looks at. The repository's settings of its gate, so they are
// in the Settings menu as Inspector settings…, not in the Inspector panel, which shows the check's
// result. Opened from the menu, from the panel's links to the goals and the
// rules, and from a link to the Inspector's Settings tab of before. The
// draft waits for Save while the dialog is closed (settingsDraft).

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { keysOnTop } from '@radical/ui/components/keysHere'
import { useDialogFocus } from './dialogKeys'
import { useInspectorStore } from '../persistence/inspector'
import { useDocumentsStore } from '../store/documentStore'
import { SettingsTab } from './inspector/SettingsTab'
import { closeCheckSettings, useCheckSettingsOpen } from './inspector/checkSettingsOpen'

export function CheckSettingsDialog(): React.ReactElement | null {
  const open = useCheckSettingsOpen((s) => s.open)
  const check = useInspectorStore((s) => s.check)
  const isFolder = useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId)?.source === 'md')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && keysOnTop(dialogRef.current, e)) closeCheckSettings() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="milestone-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCheckSettings() }}>
      <div className="milestone-modal check-settings insp" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Inspector settings">
        <button type="button" className="ai-settings-close" onClick={closeCheckSettings} aria-label="Close" title="Close (Esc)">✕</button>
        <h3 className="milestone-modal-title">Inspector settings</h3>
        <div className="check-settings-body">
          {check
            ? <SettingsTab check={check} editable={isFolder}
                readOnlyReason="Inspector settings are the check.json beside a model kept in a folder. This model is no folder, so the default rules apply and nothing here can be saved." />
            : <p className="insp-muted">Checking the model…</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
