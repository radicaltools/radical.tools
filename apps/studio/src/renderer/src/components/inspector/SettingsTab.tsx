// ─── Inspector: Settings ─────────────────────────────────────────────────────
//
// The model's check.json as a form: a goal in percent per metric, and per
// rule its severity, baseline (max) and, for test-unbound, the test files
// it looks at. Edits stay a draft until saved; the bar above them says how
// many there are and whether one loosens the CI gate, and the diff below
// shows the file as review will see it. Ratchet lowers each baseline to
// what the check finds now.

import React, { useMemo, useState } from 'react'
import {
  CHECK_METRICS, CHECK_RULES, FOLDER_RULES, GOAL_RULE, compareCheckConfig, defaultSeverity, ratchetConfig,
  type CheckConfig, type CheckConfigChange, type CheckMetric, type CheckResult, type CheckSeverity,
} from '@radical/common/check'
import { saveCheckConfig, serializeCheckConfig, useInspectorStore } from '../../persistence/inspector'
import { DIMENSIONS, RULE_INFO, dimensionOfKey, metricOf } from './shared'
import { lineDiff, patchRule, setGoal, type RulePatch } from './settingsDraft'

const FOLDER_RULE_IDS = new Set(FOLDER_RULES.map((r) => r.id))
const SEVERITIES: Array<[CheckSeverity | 'off', string, string]> = [['error', 'Error', 'e'], ['warning', 'Warning', 'w'], ['off', 'Off', 'o']]

const settingOf = (config: CheckConfig, key: string): { severity?: CheckSeverity | 'off'; max?: number; include?: string[]; exclude?: string[] } => {
  const s = config.rules?.[key]
  return s === undefined ? {} : typeof s === 'string' ? { severity: s } : s
}

/** What a loosening change does, in a sentence. */
function looseText(change: CheckConfigChange): string {
  if (change.kind === 'goal') return `${change.changes.join(', ')} lowers the goal: less of the model has to meet it before CI fails.`
  return `${change.changes.join(', ')} loosens the CI gate: more findings pass before CI fails.`
}

function GlobList({ label, globs, onChange, disabled }: { label: string; globs: string[]; onChange: (globs: string[]) => void; disabled: boolean }): React.ReactElement {
  const [text, setText] = useState('')
  const add = (): void => {
    const glob = text.trim()
    if (glob && !globs.includes(glob)) onChange([...globs, glob])
    setText('')
  }
  return (
    <div className="insp-globs">
      <span className="insp-muted">{label}</span>
      {globs.map((g) => (
        <span key={g} className="insp-glob"><code>{g}</code><button type="button" aria-label={`Remove ${g} from ${label}`} disabled={disabled} onClick={() => onChange(globs.filter((x) => x !== g))}>×</button></span>
      ))}
      <input type="text" value={text} placeholder="apps/e2e/**" aria-label={`Add to ${label}`} disabled={disabled}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
      <button type="button" className="insp-inline-link" onClick={add} disabled={disabled || !text.trim()}>Add</button>
    </div>
  )
}

export function SettingsTab({ check, editable, readOnlyReason }: { check: CheckResult; editable: boolean; readOnlyReason: string }): React.ReactElement {
  const config = useInspectorStore((s) => s.config)
  const configError = useInspectorStore((s) => s.configError)
  const [draft, setDraft] = useState<CheckConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [allMetrics, setAllMetrics] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const shown = draft ?? config
  const changes = useMemo(() => draft ? compareCheckConfig(config, draft, defaultSeverity) : [], [config, draft])
  const changeOf = (kind: 'rule' | 'goal', key: string): CheckConfigChange | undefined => changes.find((c) => c.kind === kind && c.key === key)
  const loosening = changes.filter((c) => c.loosens)
  const edit = (f: (c: CheckConfig) => CheckConfig): void => { setSaveError(null); setDraft((d) => f(d ?? config)) }
  const rule = (key: string, patch: RulePatch): void => edit((c) => patchRule(c, key, patch))
  const disabled = !editable || saving
  const ratchet = useMemo(() => ratchetConfig(shown, check), [shown, check])

  const save = async (): Promise<void> => {
    if (!draft) return
    setSaving(true)
    try {
      await saveCheckConfig(draft)
      setDraft(null)
    } catch (error) {
      setSaveError((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Goals: the ones set first, the rest on request.
  const withGoal = CHECK_METRICS.filter((m) => shown.goals?.[m.id] !== undefined || changeOf('goal', m.id))
  const others = CHECK_METRICS.filter((m) => !withGoal.includes(m))
  const metricsShown = allMetrics ? [...withGoal, ...others] : withGoal

  const goalRow = (metric: CheckMetric): React.ReactElement => {
    const now = metricOf(check, metric.id)
    const min = shown.goals?.[metric.id]?.min
    const change = changeOf('goal', metric.id)
    const dim = DIMENSIONS.get(metric.dimension)!
    return (
      <React.Fragment key={metric.id}>
        <div className={`insp-set-row goal${change ? (change.loosens ? ' loose' : ' changed') : ''}`} data-metric={metric.id}>
          <span title={metric.description}><b>{metric.label}</b> <span className="insp-muted">· {dim.perspective === 'model' ? 'Model quality' : 'Implementation'} · {dim.label}</span>
            {change && <span className={`insp-pill ${change.loosens ? 'warn' : 'new'}`}>changed</span>}</span>
          <b className="insp-set-now" title={now ? `${now.count} of ${now.total}` : undefined}>{now ? `${now.percent}%` : <span className="insp-muted">{metric.tests && !check.evidence ? 'needs test results' : '—'}</span>}</b>
          <label className="insp-set-target">
            <span className="insp-muted">≥</span>
            <input type="number" min={0} max={100} value={min ?? ''} placeholder="—" disabled={disabled} aria-label={`Goal for ${metric.label}`}
              onChange={(e) => { const v = e.target.value; if (v === '') edit((c) => setGoal(c, metric.id, null)); else if (!Number.isNaN(Number(v))) edit((c) => setGoal(c, metric.id, Number(v))) }} />
            <span className="insp-muted">%</span>
          </label>
          <span className="insp-set-state">{now && min !== undefined ? <span className={`insp-pill ${now.count * 100 >= min * now.total ? 'ok' : 'bad'}`}>{now.count * 100 >= min * now.total ? '✓ met' : '✗ below'}</span> : null}</span>
        </div>
        {change?.loosens && <div className="insp-set-warn">⚠ {looseText(change)}</div>}
      </React.Fragment>
    )
  }

  const ruleRow = (key: string): React.ReactElement => {
    const base = key.split('/')[0]
    const setting = settingOf(shown, key)
    const severity = setting.severity ?? defaultSeverity(base)
    const result = check.rules.find((r) => r.id === key)
    const change = changeOf('rule', key)
    const folderRule = FOLDER_RULE_IDS.has(base)
    // A rule that reads test reports found nothing because it did not run.
    const notRun = !!result?.notRun || (!check.evidence && !!CHECK_RULES.find((r) => r.id === base)?.readsReports)
    return (
      <React.Fragment key={key}>
        <div className={`insp-set-row rule${change ? (change.loosens ? ' loose' : ' changed') : ''}`} data-rule={key}>
          <span>
            <code className="insp-rid">{key}</code>{change && <span className={`insp-pill ${change.loosens ? 'warn' : 'new'}`}>changed</span>}
            <span className="insp-rdesc">{RULE_INFO.get(base) ?? ''}</span>
            {base === 'test-unbound' && (
              <span className="insp-globs-wrap">
                <GlobList label="Include" globs={setting.include ?? []} disabled={disabled} onChange={(include) => rule(key, { include })} />
                <GlobList label="Exclude" globs={setting.exclude ?? []} disabled={disabled} onChange={(exclude) => rule(key, { exclude })} />
              </span>
            )}
          </span>
          <span className="insp-seg" role="group" aria-label={`Severity of ${key}`}>
            {SEVERITIES.map(([value, label, cls]) => (
              <button key={value} type="button" className={cls} aria-pressed={severity === value} disabled={disabled}
                title={value === defaultSeverity(base) ? 'The default' : undefined} onClick={() => rule(key, { severity: value })}>{label}</button>
            ))}
          </span>
          <input type="number" min={0} className="insp-set-max" value={setting.max ?? ''} placeholder="—" disabled={disabled || severity === 'off'} aria-label={`Baseline of ${key}`}
            onChange={(e) => { const v = e.target.value; if (v === '') rule(key, { max: null }); else if (!Number.isNaN(Number(v))) rule(key, { max: Math.max(0, Math.round(Number(v))) }) }} />
          <b className="insp-set-now" title={folderRule ? 'radical check counts these on the folder\'s files' : undefined}>{folderRule ? '—' : notRun ? <span className="insp-muted">needs test results</span> : result?.count ?? 0}</b>
        </div>
        {change?.loosens && <div className="insp-set-warn">⚠ {looseText(change)}</div>}
      </React.Fragment>
    )
  }

  // Rules by dimension; the ones with nothing to say stay folded.
  const ruleKeys = [...FOLDER_RULES, ...CHECK_RULES].map((r) => r.id)
  const codeKeys = Object.keys(shown.rules ?? {}).filter((k) => k.includes('/'))
  const groups = [...DIMENSIONS.values()].map((d) => ({
    id: d.id as string,
    label: `${d.perspective === 'model' ? 'Model quality' : 'Implementation'} · ${d.label}`,
    keys: [...ruleKeys.filter((k) => dimensionOfKey(k) === d.id), ...codeKeys.filter((k) => !k.startsWith(`${GOAL_RULE.id}/`) && dimensionOfKey(k) === d.id)],
  })).filter((g) => g.keys.length)
  groups.push({ id: 'goals', label: 'Goals', keys: [GOAL_RULE.id, ...codeKeys.filter((k) => k.startsWith(`${GOAL_RULE.id}/`))] })
  const quiet = (key: string): boolean => {
    const s = settingOf(shown, key)
    return !(check.rules.find((r) => r.id === key)?.count) && s.max === undefined && !s.include?.length && !changeOf('rule', key)
  }

  const diff = draft ? lineDiff(serializeCheckConfig(config), serializeCheckConfig(draft)) : []

  return (
    <>
      <p className="insp-lede insp-tab-lede">What the check asks of this model. Saved to <code>check.json</code> in the model folder: <code>radical check</code> in CI reads the same file, so a change here is a change to the CI gate, reviewed in its diff.</p>
      {!editable && <p className="insp-notice">{readOnlyReason}</p>}
      {configError && <p className="insp-notice warn">{configError}. Saving writes a new check.json from these settings.</p>}

      {changes.length > 0 && (
        <div className="insp-savebar" role="status">
          <span className="insp-savebar-what">{changes.length === 1 ? '1 unsaved change' : `${changes.length} unsaved changes`}</span>
          <span className="insp-savebar-note">{loosening.length ? `${loosening.length === changes.length && changes.length === 1 ? 'It loosens' : `${loosening.length} of them loosen${loosening.length === 1 ? 's' : ''}`} the CI gate.` : 'Each one tightens the gate or keeps it.'}</span>
          {saveError && <span className="insp-savebar-error">{saveError}</span>}
          <button type="button" className="insp-btn ghost" onClick={() => { setDraft(null); setSaveError(null) }} disabled={saving}>Discard</button>
          <button type="button" className="insp-btn primary" onClick={() => void save()} disabled={saving || !editable}>{saving ? 'Saving…' : 'Save to check.json'}</button>
        </div>
      )}

      <section>
        <div className="insp-sec-head">
          <div>
            <h2>Goals</h2>
            <p className="insp-lede">Shares the model and the code must reach, in percent. Below its goal a metric fails the check (rule <code>goal-unmet</code>).</p>
          </div>
          {!allMetrics && <button type="button" className="insp-btn" onClick={() => setAllMetrics(true)}>+ Add goal</button>}
        </div>
        <div className="insp-panel insp-set">
          <div className="insp-set-row goal head"><span className="insp-label">Metric</span><span className="insp-label">Now</span><span className="insp-label">Goal</span><span /></div>
          {metricsShown.length === 0 && <p className="insp-muted insp-pad">No goals yet. Add one to hold a share of the model, whatever its size.</p>}
          {metricsShown.map(goalRow)}
          {allMetrics && <button type="button" className="insp-more insp-pad-x" onClick={() => setAllMetrics(false)}>Only the metrics with a goal</button>}
        </div>
      </section>

      <section>
        <div className="insp-sec-head">
          <div>
            <h2>Rules</h2>
            <p className="insp-lede">How each rule counts. A baseline lets up to that many findings pass as warnings; Ratchet only lowers it.</p>
          </div>
          <div className="insp-ratchet">
            <span className="insp-muted">{ratchet.lowered.length ? `${ratchet.lowered.length === 1 ? '1 baseline' : `${ratchet.lowered.length} baselines`} can come down: ${ratchet.lowered.map((l) => `${l.id} ${l.from} → ${l.to}`).join(', ')}` : 'Every baseline is at what the check finds.'}</span>
            <button type="button" className="insp-btn" disabled={disabled || !ratchet.lowered.length} onClick={() => edit(() => ratchet.config)}>Ratchet</button>
          </div>
        </div>
        <div className="insp-panel insp-set">
          <div className="insp-set-row rule head"><span className="insp-label">Rule</span><span className="insp-label">Severity</span><span className="insp-label">Baseline (max)</span><span className="insp-label">Now</span></div>
          {groups.map((g) => {
            const loud = g.keys.filter((k) => !quiet(k))
            const folded = g.keys.filter(quiet)
            const open = openGroups[g.id]
            return (
              <div key={g.id} className="insp-set-group" data-group={g.id}>
                <div className="insp-set-grp"><span className="insp-label">{g.label}</span></div>
                {(open ? g.keys : loud).map(ruleRow)}
                {folded.length > 0 && !open && (
                  <button type="button" className="insp-more insp-pad-x" onClick={() => setOpenGroups({ ...openGroups, [g.id]: true })}>
                    {folded.length === 1 ? '1 more rule' : `${folded.length} more rules`}, nothing found
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {draft && changes.length > 0 && (
        <details className="insp-panel insp-diff">
          <summary>check.json after saving <span className="insp-muted">· the diff CI and review will see</span></summary>
          <pre>{diff.map((l, i) => <span key={i} className={l.kind === '+' ? 'add' : l.kind === '-' ? 'del' : 'ctx'}>{l.kind === ' ' ? '  ' : `${l.kind} `}{l.text}{'\n'}</span>)}</pre>
        </details>
      )}
    </>
  )
}
