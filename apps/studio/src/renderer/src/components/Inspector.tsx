// ─── Inspector perspective ───────────────────────────────────────────────────
//
// What `radical check` says about the open model, in five tabs: Overview
// (a score for each dimension and what needs attention, where it opens),
// Model (the model on its own: consistency, completeness, traceability,
// decisions), Implementation (what the tests say: requirements and ADRs
// verified, tests the model does not name), This branch (what changed since
// the base, with what the tests say of it) and Settings (check.json: goals
// and rules). The header says how old the test results, measurements and
// reviews are. Each element a tab names is a link: it opens a panel with
// the element's findings, from which Studio shows it on a canvas or its
// wiki page. The check runs on the model as it is (persistence/inspector.ts).

import React, { useMemo, useState } from 'react'
import { changeWork } from '@radical/common/branchChanges'
import { compareCheckConfig, defaultSeverity } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { ElementCard, type CardBranch } from '@radical/ui/components/RightPanel'
import { revealOnCanvas, useInspectorNav, type InspectorTab } from '../navigation'
import { useInspectorStore, useSettingsDraft } from '../persistence/inspector'
import { useBranchStore } from '../persistence/branchChanges'
import { ThisBranch } from './inspector/ThisChange'
import { useDocumentsStore } from '../store/documentStore'
import { changeTotal } from './BranchChanges'
import { Errors, OpenWikiPage, Peek, ShowOnCanvas, TabBadge, dimensionOfFinding, dimensionsOf, type Ctx } from './inspector/shared'
import { OverviewTab } from './inspector/OverviewTab'
import { ModelTab } from './inspector/ModelTab'
import { ImplementationTab } from './inspector/ImplementationTab'
import { SettingsTab } from './inspector/SettingsTab'
import { FreshnessChips } from './inspector/Freshness'
import { modelChangedAt, waitingForMeasurement } from './inspector/attention'

type Tab = InspectorTab

export function Inspector(): React.ReactElement {
  const check = useInspectorStore((s) => s.check)
  const results = useInspectorStore((s) => s.results)
  const measurements = useInspectorStore((s) => s.measurements)
  const configError = useInspectorStore((s) => s.configError)
  const config = useInspectorStore((s) => s.config)
  const editedAt = useInspectorStore((s) => s.editedAt)
  const draft = useSettingsDraft()
  const unsaved = useMemo(() => !!draft && compareCheckConfig(config, draft, defaultSeverity).length > 0, [config, draft])
  // The live model, as the check and the changes read it, also while a
  // milestone is on screen (its elements are parked in liveBackup).
  const nodes = useDiagramStore((s) => s.activeSnapshotId && s.liveBackup ? s.liveBackup.nodes : s.c4Nodes) as Record<string, C4Node>
  const relations = useDiagramStore((s) => s.activeSnapshotId && s.liveBackup ? s.liveBackup.relations : s.c4Relations) as Record<string, C4Relation>
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeDoc = useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null)
  const [peekId, setPeekId] = useState<string | null>(null)
  // The verdict asks the Overview to bring Needs attention into view.
  const [attention, setAttention] = useState(0)
  // This branch opens Designer's card of an element instead.
  const cardId = useInspectorNav((s) => s.cardId)
  const setCardId = (id: string | null): void => useInspectorNav.setState({ cardId: id })
  // Until the user picks one, the first tab: Overview.
  // In a store, not in the component: the route names the tab and the card.
  const picked = useInspectorNav((s) => s.tab)
  const setTab = (tab: Tab): void => useInspectorNav.setState({ tab })
  const branch = useBranchStore()
  const tab: Tab = picked ?? 'overview'
  // The requirements and ADRs of the branch's change, by what the tests say.
  const cardBranch = useMemo((): CardBranch | null => {
    if (!branch.changes || !branch.baseModel) return null
    const baseNodes = Object.fromEntries(Object.keys(branch.changes.nodes).filter((id) => branch.baseModel!.nodes[id]).map((id) => [id, branch.baseModel!.nodes[id]]))
    return { nodes: branch.changes.nodes, baseNodes }
  }, [branch.changes, branch.baseModel])
  const work = useMemo(() => branch.changes && branch.baseModel && branch.model
    ? changeWork(branch.changes, branch.baseModel, branch.model, metamodel, results?.cases, measurements ?? undefined)
    : null, [branch.changes, branch.baseModel, branch.model, metamodel, results, measurements])
  const branchIds = useMemo(() => branch.changes && branch.base ? new Set(Object.keys(branch.changes.nodes)) : null, [branch.changes, branch.base])

  if (!check) return <div className="insp"><div className="insp-main"><p className="insp-muted">Checking the model…</p></div></div>

  const ctx: Ctx = { nodes, metamodel, evidence: check.evidence?.nodes, peek: setPeekId }
  const isFolder = activeDoc?.source === 'md'
  // The folder as the commands that read the evidence again name it.
  const folder = activeDoc?.folderPath?.split(/[\\/]/).filter(Boolean).pop() ?? activeDoc?.name ?? '<folder>'
  const changedAt = modelChangedAt(editedAt, branch.base, branch.changes ? changeTotal(branch.changes.counts) : 0)
  const inPerspective = (perspective: 'model' | 'implementation') => {
    const dims = new Set(dimensionsOf(perspective).map((d) => d.id))
    return {
      metrics: check.metrics.filter((m) => dims.has(m.dimension)),
      errors: check.findings.filter((f) => f.severity === 'error' && dims.has(dimensionOfFinding(f)!)),
    }
  }
  const model = inPerspective('model')
  const impl = inPerspective('implementation')
  const hasBranch = !!(branch.changes && branch.base)
  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ['overview', 'Overview', check.errors ? <span key="b" className="insp-pill bad">✗ {check.errors}</span> : null],
    ['model', 'Model', <TabBadge key="b" metrics={model.metrics} errors={model.errors.length} />],
    ['implementation', 'Implementation', check.evidence ? <TabBadge key="b" metrics={impl.metrics} errors={impl.errors.length} /> : <span key="b" className="insp-pill none">no results</span>],
    ...(hasBranch ? [['branch', 'This branch', <React.Fragment key="b">
      <span className="insp-pill none" title="Elements and relations changed since the base">{changeTotal(branch.changes!.counts)}</span>
      {work && work.newRequirements > 0 && <span className={`insp-pill ${work.newVerified === work.newRequirements ? 'ok' : 'warn'}`} title="New requirements of this branch verified">{work.newVerified} / {work.newRequirements} verified</span>}
    </React.Fragment>] as [Tab, string, React.ReactNode]] : []),
    ['settings', 'Settings', unsaved
      ? <span key="f" className="insp-pill warn" title="Settings changed and not saved to check.json yet">unsaved</span>
      : <code key="f" className="insp-muted">check.json</code>],
  ]

  const showAttention = (): void => { setTab('overview'); setAttention((n) => n + 1) }

  return (
    <div className="insp">
      <div className="insp-main">
        <header className="insp-head">
          <div>
            <h1>Inspector</h1>
            <div className="insp-meta-row">
              <p className="insp-meta">{activeDoc?.name ?? 'Model'} · {check.nodeCount} elements · {check.relationCount} relations · checked as you edit</p>
              <FreshnessChips results={results} measurements={measurements} folder={folder} changedAt={changedAt}
                waiting={measurements ? [] : waitingForMeasurement(check.evidence?.nodes, nodes)} />
            </div>
          </div>
          <button type="button" className={`insp-verdict ${check.errors ? 'bad' : 'ok'}`} title="Show what needs attention" onClick={showAttention}>
            {check.errors ? `✖ ${check.errors} errors` : '✓ No errors'} · {check.warnings} warnings
          </button>
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
          {tab === 'overview' && <OverviewTab check={check} ctx={ctx} relations={relations} branchIds={branchIds}
            noBranch="No base beside this model, so Studio cannot tell what this branch changed: radical hooks install saves one."
            onTab={setTab} focus={attention} onCreated={setPeekId} />}
          {tab === 'model' && <><Errors errors={model.errors} ctx={ctx} /><ModelTab check={check} ctx={ctx} relations={relations} onSettings={() => setTab('settings')} /></>}
          {tab === 'implementation' && <><Errors errors={impl.errors} ctx={ctx} />
            <ImplementationTab check={check} ctx={ctx} relations={relations} onSettings={() => setTab('settings')} /></>}
          {tab === 'branch' && !branch.base && <p className="insp-notice">There is no base beside this model any more, so there are no changes to show.</p>}
          {tab === 'branch' && branch.changes && branch.base && branch.baseModel && <ThisBranch work={work} changes={branch.changes} base={branch.base} baseModel={branch.baseModel}
            ctx={{ ...ctx, peek: (id) => { setPeekId(null); setCardId(id) } }} />}
          {tab === 'settings' && <SettingsTab check={check} editable={isFolder}
            readOnlyReason="Settings are the check.json beside a model kept in a folder. This model is no folder, so the default rules apply and nothing here can be saved." />}
        </div>
      </div>
      {peekId && <Peek id={peekId} ctx={ctx} check={check} onClose={() => setPeekId(null)} />}
      {tab === 'branch' && cardId && nodes[cardId] && (
        <ElementCard nodeId={cardId} branch={cardBranch} onClose={() => setCardId(null)}
          onOpenView={(viewId) => revealOnCanvas(cardId, viewId)} actions={<>
          <ShowOnCanvas id={cardId} className="insp-btn primary" />
          <OpenWikiPage id={cardId} className="insp-btn" />
        </>} />
      )}
    </div>
  )
}
