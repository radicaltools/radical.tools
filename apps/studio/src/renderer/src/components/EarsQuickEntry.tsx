import React, { useEffect, useState } from 'react'
import { parseEarsSentence } from '../types/metamodel'

const EARS_TYPE_LABEL: Record<string, string> = {
  ubiquitous: 'ubiquitous',
  'event-driven': 'event-driven',
  'state-driven': 'state-driven',
  'unwanted-behaviour': 'unwanted behaviour',
  optional: 'optional feature',
  complex: 'complex',
}

/**
 * Free-text alternative to picking an ears_type up front: type a plain
 * sentence, press Enter, and parseEarsSentence's heuristic fills ears_type
 * + the relevant slots. Used by both RightPanel and WikiView so the two
 * requirement editors stay in sync.
 */
export function EarsQuickEntry({
  nodeId,
  readOnly,
  updateNode,
  compact,
}: {
  nodeId: string
  readOnly?: boolean
  updateNode: (id: string, patch: Record<string, unknown>) => void
  compact?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [appliedType, setAppliedType] = useState<string | null>(null)

  // A quick-entry draft belongs to whichever node it was typed for — if the
  // user switches nodes without submitting, don't apply it to the new one.
  useEffect(() => {
    setDraft('')
    setAppliedType(null)
  }, [nodeId])

  if (readOnly) return null

  const apply = () => {
    const text = draft.trim()
    if (!text) return
    const parsed = parseEarsSentence(text)
    if (!parsed.action) return
    updateNode(nodeId, {
      ears_type: parsed.ears_type,
      action: parsed.action,
      trigger: parsed.trigger,
      precondition: parsed.precondition,
      unwanted_condition: parsed.unwanted_condition,
      feature: parsed.feature,
    })
    setAppliedType(parsed.ears_type)
    setDraft('')
  }

  return (
    <div className={compact ? 'ears-quick-entry ears-quick-entry-sm' : 'ears-quick-entry'}>
      <input
        className="ears-quick-entry-input"
        value={draft}
        placeholder="Or type it as a sentence, e.g. “When the user clicks save, the system shall persist the document” — press Enter"
        onChange={(e) => {
          setDraft(e.target.value)
          if (appliedType) setAppliedType(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); apply() }
        }}
      />
      {appliedType && (
        <span className="ears-quick-entry-hint">Detected: {EARS_TYPE_LABEL[appliedType] ?? appliedType}</span>
      )}
    </div>
  )
}
