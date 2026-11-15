// ─── Inspector ───────────────────────────────────────────────────────────────
//
// What `radical check` says about the open model, as a place of the
// activity rail, as the Views section is (ADR Inspector is a panel): its
// button on the rail, above Settings, shows its tabs in the left panel and
// the tab picked in place of the view, in Designer, Viewer and Presenter.
// A section's tab on the rail, the button again or ⌘J goes back to the
// view. Four tabs: Overview (a score for each dimension and
// what needs attention), Model (the model on its own: consistency,
// completeness, traceability, decisions), Implementation (what the tests
// say: requirements and ADRs verified, tests the model does not name) and
// This branch (what changed since the base, with what the tests say of it).
// A bar over it says how old the test results, measurements and reviews
// are, and gives the verdict.
// Each element a tab names is a link: it shows the element in the
// perspective open, selected with its properties card (showElement). What
// it may change is what the perspective may: its fixes edit the model in
// Designer, and from Viewer or Presenter they are made in Designer. The
// check runs on the live model as it is (persistence/inspector.ts). The
// check.json settings are Inspector settings… in the Settings menu.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { changeWork } from '@radical/common/branchChanges'
import { testsRanAt, withBoundTests } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { showElement, toggleInspector, useInspectorNav, usePlaceHold, type InspectorTab } from '../navigation'
import { useEvidenceRead, useInspectorStore } from '../persistence/inspector'
import { useBranchStore } from '../persistence/branchChanges'
import { NoBase, ThisBranch } from './inspector/ThisChange'
import { useDocumentsStore } from '../store/documentStore'
import { changeTotal } from './BranchChanges'
import { Errors, TabBadge, dimensionOfFinding, dimensionsOf, type Ctx } from './inspector/shared'
import { OverviewTab } from './inspector/OverviewTab'
import { ModelTab } from './inspector/ModelTab'
import { ImplementationTab } from './inspector/ImplementationTab'
import { FreshnessChips } from './inspector/Freshness'
import { modelChangedAt, waitingForMeasurement } from './inspector/attention'
import { TracePanel } from './inspector/TracePanel'
import { openCheckSettings } from './inspector/checkSettingsOpen'

type Tab = InspectorTab

/** The shortcut that opens and closes the panel, as VS Code's ⌘J. */
export const INSPECTOR_KEYS = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘J' : 'Ctrl+J'

/** The branch's changes and what the tests say of them (This branch). */
function useBranchWork(): { branch: ReturnType<typeof useBranchStore.getState>; work: ReturnType<typeof changeWork> | null } {
  const branch = useBranchStore()
  const results = useInspectorStore((s) => s.results)
  const measurements = useInspectorStore((s) => s.measurements)
  const metamodel = useDiagramStore((s) => s.metamodel)
  // The tests the repository's .radical/radical.json binds are each one's.
  const verifies = useDiagramStore((s) => s.repository?.verifies)
  const work = useMemo(() => branch.changes && branch.baseModel && branch.model
    ? changeWork(branch.changes, branch.baseModel, { ...branch.model, nodes: Object.fromEntries(withBoundTests(Object.values(branch.model.nodes), verifies).map((n) => [n.id, n])) }, metamodel, results?.cases, measurements ?? undefined)
    : null, [branch.changes, branch.baseModel, branch.model, metamodel, results, measurements, verifies])
  return { branch, work }
}

/** The Inspector's tabs, in the left panel in place of its sections. */
export function InspectorSection(): React.ReactElement {
  // Its counts once the files beside the model are read, never a partial one.
  const read = useEvidenceRead()
  const check = useInspectorStore((s) => (read ? s.check : null))
  const { branch, work } = useBranchWork()
  const tab: Tab = useInspectorNav((s) => s.tab) ?? 'overview'
  return <SideNav tab={tab} onTab={(t) => useInspectorNav.setState({ tab: t })} check={check} branch={branch} work={work} />
}

/** The tab picked, in place of the view. */
export function InspectorMain(): React.ReactElement {
  const check = useInspectorStore((s) => s.check)
  const read = useEvidenceRead()
  const results = useInspectorStore((s) => s.results)
  const measurements = useInspectorStore((s) => s.measurements)
  const configError = useInspectorStore((s) => s.configError)
  const editedAt = useInspectorStore((s) => s.editedAt)
  // The live model, as the check and the changes read it, also while a
  // milestone is on screen (its elements are parked in liveBackup).
  const nodes = useDiagramStore((s) => s.activeSnapshotId && s.liveBackup ? s.liveBackup.nodes : s.c4Nodes) as Record<string, C4Node>
  const relations = useDiagramStore((s) => s.activeSnapshotId && s.liveBackup ? s.liveBackup.relations : s.c4Relations) as Record<string, C4Relation>
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeDoc = useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null)
  // The verification path on screen is part of the place (the route), and
  // the panel's Back walks the paths opened from it.
  const traceId = useInspectorNav((s) => s.trace)
  const setTrace = (id: string | null): void => useInspectorNav.setState({ trace: id })
  const [traceStack, setTraceStack] = useState<string[]>([])
  useEffect(() => {
    setTraceStack((s) => !traceId ? [] : s[s.length - 1] === traceId ? s : s[s.length - 2] === traceId ? s.slice(0, -1) : [...s, traceId])
  }, [traceId])
  // The verdict asks the Overview to bring Needs attention into view.
  const [attention, setAttention] = useState(0)
  // Until the user picks one, the first tab: Overview.
  // In a store, not in the component: the route names the tab.
  const picked = useInspectorNav((s) => s.tab)
  const setTab = (tab: Tab): void => useInspectorNav.setState({ tab })
  const { branch, work } = useBranchWork()
  const tab: Tab = picked ?? 'overview'
  const branchIds = useMemo(() => branch.changes && branch.base ? new Set(Object.keys(branch.changes.nodes)) : null, [branch.changes, branch.base])

  // An element it names is shown on the view, which the Inspector gives
  // back: one move, so Back returns to the Inspector (usePlaceHold).
  const show = useCallback((id: string): void => {
    usePlaceHold.setState((h) => ({ held: h.held + 1 }))
    try {
      toggleInspector(false)
      showElement(id)
    } finally {
      usePlaceHold.setState((h) => ({ held: Math.max(0, h.held - 1) }))
    }
  }, [])

  // The verdict leads to what needs attention, on the Overview.
  const onVerdict = (): void => { setTrace(null); setTab('overview'); setAttention((n) => n + 1) }

  // The whole check, with what was read beside the model, or none: a check
  // without the test results said "no results" for a moment.
  if (!check || !read) {
    return (
      <Main>
        <div className="insp-body"><div className="insp-main"><p className="insp-muted">Checking the model…</p></div></div>
      </Main>
    )
  }

  const ctx: Ctx = { nodes, metamodel, evidence: check.evidence?.nodes, peek: show }
  const tracing = !!traceId && !!nodes[traceId] && traceStack.length > 0
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

  return (
    <Main>
      {!tracing && (
        <header className="insp-topbar">
          <FreshnessChips results={results} measurements={measurements} folder={folder} changedAt={changedAt}
            waiting={measurements ? [] : waitingForMeasurement(check.evidence?.nodes, nodes)} />
          <Verdict check={check} onClick={onVerdict} />
        </header>
      )}
      <div className="insp-body">
        {tracing && (
          <TracePanel stack={traceStack} nodes={nodes} relations={relations} evidence={check.evidence} cases={results?.cases}
            ranAt={results ? testsRanAt(results) : undefined} folderPath={activeDoc?.folderPath}
            onTrace={setTrace} onBack={() => setTrace(traceStack[traceStack.length - 2] ?? null)} onClose={() => setTrace(null)} onDetails={show} />
        )}
        <div className="insp-main" hidden={tracing}>
          <div id="insp-panel" role="tabpanel" aria-labelledby={`insp-tab-${tab}`} className="insp-tabpanel">
            {configError && <p className="insp-notice warn">{configError}. The default rule settings apply.</p>}
            {tab === 'overview' && <OverviewTab check={check} ctx={ctx} relations={relations} branchIds={branchIds}
              noBranch="No base beside this model, so Studio cannot tell what this branch changed: radical hooks install saves one."
              onTab={setTab} focus={attention} onCreated={show} />}
            {tab === 'model' && <><Errors errors={model.errors} ctx={ctx} /><ModelTab check={check} ctx={ctx} relations={relations} onSettings={openCheckSettings} /></>}
            {tab === 'implementation' && <><Errors errors={impl.errors} ctx={ctx} />
              <ImplementationTab check={check} ctx={ctx} relations={relations} onSettings={openCheckSettings} /></>}
            {tab === 'branch' && !branch.base && <NoBase />}
            {tab === 'branch' && branch.changes && branch.base && branch.baseModel && <ThisBranch work={work} changes={branch.changes} base={branch.base} baseModel={branch.baseModel} ctx={ctx} />}
          </div>
        </div>
      </div>
    </Main>
  )
}

/** The Inspector's box in place of the view. */
function Main({ children }: { children: React.ReactNode }): React.ReactElement {
  return <section id="insp-dock" className="insp insp-area" aria-label="Inspector">{children}</section>
}

const TAB_INFO: Record<Tab, { label: string; about: string; icon: React.ReactNode }> = {
  overview: { label: 'Overview', about: 'Scores and what needs attention', icon: <path d="M2.5 13.5h11M4 11V7m4 4V4m4 7V8.5" /> },
  model: { label: 'Model', about: 'The model on its own', icon: <><rect x="2" y="2.5" width="5" height="4" rx="1" /><rect x="9" y="9.5" width="5" height="4" rx="1" /><path d="M4.5 6.5v3.5a1.5 1.5 0 0 0 1.5 1.5h3" /></> },
  implementation: { label: 'Implementation', about: 'What the tests say', icon: <><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" /></> },
  branch: { label: 'This branch', about: 'Changed since the base', icon: <><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="5.5" r="1.5" /><path d="M4.5 5v6M11.5 7c0 2.5-2 3-7 4" /></> },
}

/** The Inspector's tabs, drawn as the Views section draws its views: the
 *  section's head (its name and the errors), then a card for each tab,
 *  ↑/↓ moving between them. */
function SideNav({ tab, onTab, check, branch, work }: {
  tab: Tab
  onTab: (tab: Tab) => void
  check: ReturnType<typeof useInspectorStore.getState>['check']
  branch: ReturnType<typeof useBranchStore.getState>
  work: ReturnType<typeof changeWork> | null
}): React.ReactElement {
  const hasBranch = !!(branch.changes && branch.base)
  const dims = (perspective: 'model' | 'implementation') => {
    if (!check) return null
    const ids = new Set(dimensionsOf(perspective).map((d) => d.id))
    return { metrics: check.metrics.filter((m) => ids.has(m.dimension)), errors: check.findings.filter((f) => f.severity === 'error' && ids.has(dimensionOfFinding(f)!)).length }
  }
  const model = dims('model')
  const impl = dims('implementation')
  const tabs: Array<[Tab, React.ReactNode]> = [
    ['overview', check?.errors ? <span key="b" className="insp-pill bad">✗ {check.errors}</span> : null],
    ['model', model ? <TabBadge key="b" metrics={model.metrics} errors={model.errors} /> : null],
    ['implementation', !check ? null : check.evidence && impl ? <TabBadge key="b" metrics={impl.metrics} errors={impl.errors} /> : <span key="b" className="insp-pill none">no results</span>],
    // Changes on branch is here only: without a base, how to save one.
    ['branch', hasBranch ? <React.Fragment key="b">
      <span className="insp-pill none" title="Elements and relations changed since the base">{changeTotal(branch.changes!.counts)}</span>
      {work && work.newRequirements > 0 && <span className={`insp-pill ${work.newVerified === work.newRequirements ? 'ok' : 'warn'}`} title="New requirements of this branch verified">{work.newVerified} / {work.newRequirements} verified</span>}
      {branch.on && <span className="insp-pill new" title="Marked on the canvas">on the canvas</span>}
    </React.Fragment> : <span key="b" className="insp-pill none">no base</span>],
  ]
  const pick = (id: Tab): void => { useInspectorNav.setState({ trace: null }); onTab(id) }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const at = tabs.findIndex(([id]) => id === tab)
    const next = tabs[(at + (e.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length][0]
    pick(next)
    e.currentTarget.querySelector<HTMLElement>(`#insp-tab-${next}`)?.focus()
  }
  return (
    <div className="insp-side lp-section" style={{ ['--sec-color' as string]: check?.errors ? 'var(--danger)' : 'var(--success)' }}>
      <div className="lp-section-head">
        <span className="lp-section-title">Inspector</span>
        {check && <span className="lp-section-count" title={`${check.errors} errors, ${check.warnings} warnings`}>{check.errors}</span>}
      </div>
      <div className="lp-section-body">
        <div className="lp-section-body-pad">
          <div className="insp-side-list" role="tablist" aria-orientation="vertical" aria-label="Inspector" onKeyDown={onKeyDown}>
            {tabs.map(([id, badge]) => (
              <button key={id} type="button" role="tab" id={`insp-tab-${id}`} aria-selected={tab === id} aria-controls="insp-panel"
                tabIndex={tab === id ? 0 : -1} className={`lp-card insp-side-card${tab === id ? ' active' : ''}`} onClick={() => pick(id)}>
                <span className="lp-view-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_INFO[id].icon}</svg>
                </span>
                <span className="lp-card-body">
                  <span className="lp-card-title">{TAB_INFO[id].label}</span>
                  <span className="lp-card-meta"><span>{TAB_INFO[id].about}</span></span>
                  {badge && <span className="insp-side-badges">{badge}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The check's verdict, which leads to what needs attention. The tab's
 *  name is in the left panel's list, so the report has no head of its own. */
function Verdict({ check, onClick }: { check: NonNullable<ReturnType<typeof useInspectorStore.getState>['check']>; onClick: () => void }): React.ReactElement {
  return (
    <button type="button" className={`insp-verdict ${check.errors ? 'bad' : 'ok'}`} title="Show what needs attention" onClick={onClick}>
      {check.errors ? `✖ ${check.errors} errors` : '✓ No errors'} · {check.warnings} warnings
    </button>
  )
}
