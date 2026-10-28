import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import {
  loadStudioSettings, updateStudioSettings, STUDIO_SETTINGS_CHANGED_EVENT, type SpecialKey,
} from '@radical/ui/studioSettings'
import { saveThemePref, useThemePref, type ThemePref } from '../theme'
import { loadAISettings, saveAISettings } from '../ai/settings'
import { listAdapters } from '../ai/registry'
import type { AIProviderId } from '../ai/types'
import { useDialogFocus } from './dialogKeys'

// ─── Setup wizard ───────────────────────────────────────────────────────────
// Opens on the first start in a browser or the desktop app (not in VS Code,
// whose editor sets the theme), and again from Settings → Setup…. One step
// each for the theme, the special key, the canvas and an AI provider; every
// choice is applied and stored at once, so Back, Skip and Finish only move.

export const OPEN_SETUP_EVENT = 'radical:open-setup'

export function openSetup(): void {
  window.dispatchEvent(new Event(OPEN_SETUP_EVENT))
}

type StepId = 'theme' | 'key' | 'canvas' | 'ai'
const STEPS: { id: StepId; title: string }[] = [
  { id: 'theme', title: 'Theme' },
  { id: 'key', title: 'Special key' },
  { id: 'canvas', title: 'Canvas' },
  { id: 'ai', title: 'AI provider' },
]

const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')
const KEYS: { id: SpecialKey; glyph: string; name: string }[] = [
  { id: 'alt', glyph: isMac ? '⌥' : 'Alt', name: isMac ? 'Option' : 'Alt' },
  { id: 'shift', glyph: '⇧', name: 'Shift' },
  { id: 'ctrl', glyph: isMac ? '⌃' : 'Ctrl', name: 'Ctrl' },
  { id: 'meta', glyph: isMac ? '⌘' : '⊞', name: isMac ? 'Cmd' : 'Win' },
]

export function SetupWizard({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const [step, setStep] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useDialogFocus(box, open)
  useEffect(() => { if (open) setStep(0) }, [open])

  const done = useCallback(() => {
    updateStudioSettings({ setupDone: true })
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); done() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, done])

  if (!open) return null
  const last = step === STEPS.length - 1
  const id = STEPS[step].id

  return createPortal(
    <div className="milestone-modal-backdrop setup-backdrop">
      <div className="setup-wizard" ref={box} role="dialog" aria-modal="true" aria-label="Set up Radical Studio">
        <div className="setup-head">
          <span className="setup-kicker">Set up Radical Studio</span>
          <ol className="setup-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`setup-dot${i === step ? ' current' : ''}${i < step ? ' passed' : ''}`}
                  aria-label={s.title}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => setStep(i)}
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="setup-body">
          {id === 'theme' && <ThemeStep />}
          {id === 'key' && <KeyStep />}
          {id === 'canvas' && <CanvasStep />}
          {id === 'ai' && <AIStep />}
        </div>
        <div className="setup-foot">
          <button type="button" className="milestone-btn ghost" onClick={done}>Skip setup</button>
          <span className="setup-foot-hint">Settings on the activity rail changes these later.</span>
          {step > 0 && <button type="button" className="milestone-btn" onClick={() => setStep(step - 1)}>Back</button>}
          <button
            type="button"
            className="milestone-btn primary"
            onClick={() => (last ? done() : setStep(step + 1))}
          >
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ThemeStep(): React.ReactElement {
  const { pref } = useThemePref()
  const options: { id: ThemePref; label: string; hint: string }[] = [
    { id: 'system', label: 'System', hint: 'As the operating system, day and night' },
    { id: 'light', label: 'Light', hint: 'For bright rooms and projectors' },
    { id: 'dark', label: 'Dark', hint: 'For long sessions' },
  ]
  return (
    <>
      <h3 className="setup-title">How should Studio look?</h3>
      <div className="setup-choices three" role="radiogroup" aria-label="Theme">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={pref === o.id}
            className={`setup-choice${pref === o.id ? ' chosen' : ''}`}
            onClick={() => saveThemePref(o.id)}
          >
            <span className={`setup-swatch ${o.id}`} aria-hidden />
            <span className="setup-choice-label">{o.label}</span>
            <span className="setup-choice-hint">{o.hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function KeyStep(): React.ReactElement {
  const key = useDiagramStore((s) => s.connectionModifier)
  const setKey = useDiagramStore((s) => s.setConnectionModifier)
  const name = KEYS.find((k) => k.id === key)?.name ?? key
  return (
    <>
      <h3 className="setup-title">Which key does the special things?</h3>
      <p className="setup-text">Hold it on the canvas:</p>
      <ul className="setup-uses">
        <li><b>Drag from an element to another</b> to connect them.</li>
        <li><b>Drag an element onto a container</b> to put it inside.</li>
        <li><b>Click elements</b> to pick several, or drag on the empty canvas to box them.</li>
        <li><b>Drop a type from the palette</b> without its wizard.</li>
      </ul>
      <div className="setup-choices four" role="radiogroup" aria-label="Special key">
        {KEYS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={key === k.id}
            className={`setup-choice key${key === k.id ? ' chosen' : ''}`}
            onClick={() => setKey(k.id)}
          >
            <kbd className="setup-key">{k.glyph}</kbd>
            <span className="setup-choice-label">{k.name}</span>
          </button>
        ))}
      </div>
      <p className="setup-text muted">Without {name}, a drag moves elements and the canvas.</p>
    </>
  )
}

function CanvasStep(): React.ReactElement {
  const focus = useDiagramStore((s) => s.selectionFocus)
  const toggleFocus = useDiagramStore((s) => s.toggleSelectionFocus)
  const smartFit = useDiagramStore((s) => s.autoFitActive)
  const toggleSmartFit = useDiagramStore((s) => s.toggleAutoFit)
  const [wizardOnCreate, setWizardOnCreate] = useState(() => loadStudioSettings().nodeWizardOnCreate)
  useEffect(() => {
    const reload = (): void => setWizardOnCreate(loadStudioSettings().nodeWizardOnCreate)
    window.addEventListener(STUDIO_SETTINGS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(STUDIO_SETTINGS_CHANGED_EVENT, reload)
  }, [])
  const row = (label: string, hint: string, on: boolean, change: () => void): React.ReactElement => (
    <label className="setup-switch">
      <input type="checkbox" checked={on} onChange={change} />
      <span className="setup-switch-text">
        <span className="setup-choice-label">{label}</span>
        <span className="setup-choice-hint">{hint}</span>
      </span>
    </label>
  )
  return (
    <>
      <h3 className="setup-title">How should the canvas help?</h3>
      <div className="setup-switches">
        {row('Focus', 'A selection dims what it is not related to, and the camera frames it.', focus, toggleFocus)}
        {row('Smart fit', 'The camera follows the diagram: it fits on open and shows what an expand reveals.', smartFit, toggleSmartFit)}
        {row('Wizard on create', 'A new ADR, requirement or other guided type opens its form.', wizardOnCreate,
          () => updateStudioSettings({ nodeWizardOnCreate: !wizardOnCreate }))}
      </div>
    </>
  )
}

type AIChoice = 'none' | AIProviderId

function AIStep(): React.ReactElement {
  const [settings, setSettings] = useState(() => loadAISettings())
  const choice: AIChoice = settings.enabled ? settings.active : 'none'
  const persist = (next: typeof settings): void => {
    setSettings(next)
    saveAISettings(next)
    window.dispatchEvent(new CustomEvent('radical:ai-settings-changed'))
  }
  const pick = (c: AIChoice): void => {
    persist(c === 'none' ? { ...settings, enabled: false } : { ...settings, enabled: true, active: c })
  }
  const adapters = listAdapters()
  const chosen = adapters.find((a) => a.id === choice)
  return (
    <>
      <h3 className="setup-title">Use an AI provider?</h3>
      <p className="setup-text">
        Radical Forge and the chat run on a provider of your own. The key stays in this browser.
      </p>
      <div className="setup-choices list" role="radiogroup" aria-label="AI provider">
        <button
          type="button"
          role="radio"
          aria-checked={choice === 'none'}
          className={`setup-choice row${choice === 'none' ? ' chosen' : ''}`}
          onClick={() => pick('none')}
        >
          <span className="setup-choice-label">Not now</span>
        </button>
        {adapters.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={choice === a.id}
            className={`setup-choice row${choice === a.id ? ' chosen' : ''}`}
            onClick={() => pick(a.id)}
          >
            <span className="setup-choice-label">{a.label}</span>
          </button>
        ))}
      </div>
      {chosen && chosen.id !== 'ollama' && (
        <label className="setup-field">
          <span>API key</span>
          <input
            type="password"
            value={settings.providers[chosen.id].apiKey}
            placeholder={`Paste your ${chosen.label} API key…`}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => persist({
              ...settings,
              providers: { ...settings.providers, [chosen.id]: { ...settings.providers[chosen.id], apiKey: e.target.value } },
            })}
          />
        </label>
      )}
      {chosen?.id === 'ollama' && (
        <p className="setup-text muted">Ollama runs on this machine without a key; the browser must be allowed to call it (AI providers… says how).</p>
      )}
      <p className="setup-text muted">Model, base URL and a connection test are under Settings → AI providers…</p>
    </>
  )
}
