// ─── Mockup wireframe section ───────────────────────────────────────────────
// Preview of a Mockup node's AI-generated low-fi wireframe plus its actions
// (generate / regenerate, remove, open the external design link). Shared by
// the properties panel and the Wiki element page.

import React, { useEffect, useRef, useState } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { loadAISettings } from '../ai/settings'
import { generateWireframe, wireframeDataUri } from '../ai/mockupWireframe'

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function MockupWireframe({
  nodeId,
  readOnly,
  heading = <div className="props-section-title">Wireframe</div>,
  className = 'mockup-wf',
}: {
  nodeId: string
  readOnly: boolean
  heading?: React.ReactNode
  className?: string
}): React.ReactElement | null {
  const node = useDiagramStore((s) => s.c4Nodes[nodeId]) as unknown as Record<string, unknown> | undefined
  const updateNode = useDiagramStore((s) => s.updateNode)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cancel an in-flight generation when the component switches to another node.
  useEffect(() => {
    setStatus(null)
    return () => abortRef.current?.abort()
  }, [nodeId])

  if (!node) return null
  const wireframe = typeof node.wireframe === 'string' ? node.wireframe : ''
  const link = typeof node.link === 'string' ? node.link.trim() : ''
  const aiEnabled = loadAISettings().enabled

  const generate = async (): Promise<void> => {
    const settings = loadAISettings()
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setStatus(null)
    try {
      const { c4Nodes, c4Relations } = useDiagramStore.getState()
      const { svg, usage } = await generateWireframe(nodeId, c4Nodes, c4Relations, settings, ac.signal)
      updateNode(nodeId, { wireframe: svg } as Parameters<typeof updateNode>[1])
      setStatus(usage ? { kind: 'info', text: `${usage.inputTokens + usage.outputTokens} tokens` } : null)
    } catch (err) {
      if (!ac.signal.aborted) setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }

  return (
    <div className={className}>
      {heading}
      {wireframe ? (
        <img className="mockup-wf-preview" src={wireframeDataUri(wireframe)} alt="Wireframe" />
      ) : (
        <div className="mockup-wf-empty">
          {aiEnabled
            ? 'Link requirements / scenarios with “Illustrates”, then generate a low-fi wireframe.'
            : 'Enable AI in settings to generate a wireframe, or add a design link.'}
        </div>
      )}
      <div className="mockup-wf-actions">
        {link && isHttpUrl(link) && (
          <button className="mockup-wf-btn" onClick={() => window.open(link, '_blank', 'noopener')}>
            🔗 Open design
          </button>
        )}
        {!readOnly && aiEnabled && (
          busy ? (
            <button className="mockup-wf-btn" onClick={() => abortRef.current?.abort()}>
              Cancel…
            </button>
          ) : (
            <button className="mockup-wf-btn" onClick={() => void generate()}>
              ✨ {wireframe ? 'Regenerate' : 'Generate'} wireframe
            </button>
          )
        )}
        {!readOnly && wireframe && !busy && (
          <button className="mockup-wf-btn" onClick={() => updateNode(nodeId, { wireframe: undefined } as Parameters<typeof updateNode>[1])}>
            Remove
          </button>
        )}
      </div>
      {status && (
        <div className={`mockup-wf-status mockup-wf-status--${status.kind}`}>{status.text}</div>
      )}
    </div>
  )
}
