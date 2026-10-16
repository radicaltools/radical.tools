// ─── Inspector perspective ───────────────────────────────────────────────────
//
// What `radical check` says about the open model, in three tabs: Model
// quality (the model on its own: consistency, completeness, traceability,
// decisions), Implementation (what the tests say: requirements and ADRs
// verified, tests the model does not name) and Settings (check.json: goals
// and rules). Each element a tab names is a link: it opens a panel with
// the element's findings, from which Studio shows it on a canvas or its
// wiki page. The check runs on the model as it is (persistence/inspector.ts).

import React, { useMemo, useState } from 'react'
import { changeWork } from '@radical/common/branchChanges'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { ElementCard, type CardBranch } from '@radical/ui/components/RightPanel'
import { useInspectorNav, type InspectorTab } from '../navigation'
import { useInspectorStore } from '../persistence/inspector'
import { useBranchStore } from '../persistence/branchChanges'
import { ThisChange } from './inspector/ThisChange'
import { ChangesTab } from './inspector/ChangesTab'
import { useDocumentsStore } from '../store/documentStore'
import { Errors, OpenWikiPage, Peek, ShowOnCanvas, TabBadge, dimensionOfFinding, dimensionsOf, type Ctx } from './inspector/shared'
import { ModelTab } from './inspector/ModelTab'
import { ImplementationTab } from './inspector/ImplementationTab'
import { SettingsTab } from './inspector/SettingsTab'

type Tab = InspectorTab

export function Inspector(): React.ReactElement {
  const check = useInspectorStore((s) => s.check)
  const results = useInspectorStore((s) => s.results)
  const configError = useInspectorStore((s) => s.configError)
  const nodes = useDiagramStore((s) => s.c4Nodes) as Record<string, C4Node>
  const relations = useDiagramStore((s) => s.c4Relations) as Record<string, C4Relation>
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeDoc = useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null)
  const [peekId, setPeekId] = useState<string | null>(null)
  // The Changes tab opens Designer's card of an element instead.
  const cardId = useInspectorNav((s) => s.cardId)
  const setCardId = (id: string | null): void => useInspectorNav.setState({ cardId: id })
  // Until the user picks one, the first tab: Changes when the folder holds a base.
  // In a store, not in the component: the route names the tab and the card.
  const picked = useInspectorNav((s) => s.tab)
  const setTab = (tab: Tab): void => useInspectorNav.setState({ tab })
  const branch = useBranchStore()
  const tab: Tab = picked ?? (branch.changes ? 'changes' : 'model')
  // The requirements and ADRs of the branch's change, by what the tests say.
  const cardBranch = useMemo((): CardBranch | null => {
    if (!branch.changes || !branch.baseModel) return null
    const baseNodes = Object.fromEntries(Object.keys(branch.changes.nodes).filter((id) => branch.baseModel!.nodes[id]).map((id) => [id, branch.baseModel!.nodes[id]]))
    return { nodes: branch.changes.nodes, baseNodes }
  }, [branch.changes, branch.baseModel])
  const work = useMemo(() => branch.changes && branch.baseModel && branch.model
    ? changeWork(branch.changes, branch.baseModel, branch.model, metamodel, results?.cases)
    : null, [branch.changes, branch.baseModel, branch.model, metamodel, results])

  if (!check) return <div className="insp"><div className="insp-main"><p className="insp-muted">Checking the model…</p></div></div>

  const ctx: Ctx = { nodes, metamodel, evidence: check.evidence?.nodes, peek: setPeekId }
  const isFolder = activeDoc?.source === 'md'
  const readAt = results ? new Date(results.readAt) : null
  const inPerspective = (perspective: 'model' | 'implementation') => {
    const dims = new Set(dimensionsOf(perspective).map((d) => d.id))
    return {
      metrics: check.metrics.filter((m) => dims.has(m.dimension)),
      errors: check.findings.filter((f) => f.severity === 'error' && dims.has(dimensionOfFinding(f)!)),
    }
  }
  const model = inPerspective('model')
  const impl = inPerspective('implementation')
  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ...(branch.changes && branch.base ? [['changes', 'Changes', <span key="c" className="insp-pill none">{branch.changes.counts.added + branch.changes.counts.changed + branch.changes.counts.removed}</span>] as [Tab, string, React.ReactNode]] : []),
    ['model', 'Model quality', <TabBadge key="b" metrics={model.metrics} errors={model.errors.length} />],
    ['implementation', 'Implementation', <React.Fragment key="b">
      {check.evidence ? <TabBadge metrics={impl.metrics} errors={impl.errors.length} /> : <span className="insp-pill none">no results</span>}
      {work && work.newRequirements > 0 && <span className={`insp-pill ${work.newVerified === work.newRequirements ? 'ok' : 'warn'}`} title="New requirements of this change verified">This change {work.newVerified} / {work.newRequirements}</span>}
    </React.Fragment>],
    ['settings', 'Settings', <code key="f" className="insp-muted">check.json</code>],
  ]

  return (
    <div className="insp">
      <div className="insp-main">
        <header className="insp-head">
          <div>
            <h1>Inspector</h1>
            <p className="insp-meta">
              {activeDoc?.name ?? 'Model'} · {check.nodeCount} elements · {check.relationCount} relations · checked as you edit
              {readAt ? <> · tests read {readAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ({results!.cases.length} test cases)</> : null}
            </p>
          </div>
          <span className={`insp-verdict ${check.errors ? 'bad' : 'ok'}`}>{check.errors ? `✖ ${check.errors} errors` : '✓ No errors'} · {check.warnings} warnings</span>
        </header>

        <nav className="insp-tabs" role="tablist" aria-label="Inspector">
          {tabs.map(([id, label, badge]) => (
            <button key={id} type="button" role="tab" id={`insp-tab-${id}`} aria-selected={tab === id} aria-controls="insp-panel"
              className={`insp-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}{badge}
            </button>
          ))}
        </nav>

        <div id="insp-panel" role="tabpanel" aria-labelledby={`insp-tab-${tab}`} className="insp-tabpanel">
          {configError && tab !== 'settings' && <p className="insp-notice warn">{configError}. The default rule settings apply.</p>}
          {tab === 'model' && <><Errors errors={model.errors} ctx={ctx} /><ModelTab check={check} ctx={ctx} relations={relations} onSettings={() => setTab('settings')} /></>}
          {tab === 'implementation' && <><Errors errors={impl.errors} ctx={ctx} />
            {work && branch.changes && branch.base && branch.baseModel && <ThisChange work={work} changes={branch.changes} base={branch.base} baseModel={branch.baseModel} ctx={ctx} onAllChanges={() => setTab('changes')} />}
            <ImplementationTab check={check} ctx={ctx} relations={relations} results={results} onSettings={() => setTab('settings')} /></>}
          {tab === 'changes' && !branch.base && <p className="insp-notice">There is no base beside this model any more, so there are no changes to show.</p>}
          {tab === 'changes' && branch.changes && branch.base && branch.baseModel && <ChangesTab changes={branch.changes} base={branch.base} baseModel={branch.baseModel}
            ctx={{ ...ctx, peek: (id) => { setPeekId(null); setCardId(id) } }} />}
          {tab === 'settings' && <SettingsTab check={check} editable={isFolder}
            readOnlyReason="Settings are the check.json beside a model kept in a folder. This model is no folder, so the default rules apply and nothing here can be saved." />}
        </div>
      </div>
      {peekId && <Peek id={peekId} ctx={ctx} check={check} onClose={() => setPeekId(null)} />}
      {tab === 'changes' && cardId && nodes[cardId] && (
        <ElementCard nodeId={cardId} branch={cardBranch} onClose={() => setCardId(null)} actions={<>
          <ShowOnCanvas id={cardId} className="insp-btn primary" />
          <OpenWikiPage id={cardId} className="insp-btn" />
        </>} />
      )}
    </div>
  )
}
