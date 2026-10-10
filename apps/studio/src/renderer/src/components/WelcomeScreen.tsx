import React, { useEffect, useState } from 'react'
import { documents } from '../store/documentStore'
import { aiReady, loadAISettings } from '../ai/settings'
import { BrowserIcon, ModelRow, NewModelStep, OpenSources, StepRow, openSample } from './ModelSteps'

interface Props {
  onDismiss: () => void
}

/** Stylised slice of the fintech sample: the C4 core with the ADR,
 *  requirement and mockup layers hanging off it. Labels are real nodes. */
function SamplePreview(): React.ReactElement {
  const font = 'system-ui, sans-serif'
  return (
    <svg className="welcome-sample-preview" width="100%" viewBox="0 0 280 150" fill="none" aria-hidden="true">
      <defs>
        <marker id="welcome-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#9aa3b8"/>
        </marker>
      </defs>

      {/* governance / product links (dashed) */}
      <g stroke="#b8bfd0" strokeWidth="1" strokeDasharray="3 2">
        <path d="M45 96 C45 70 120 70 128 52"/>
        <path d="M139 96 L139 52"/>
        <path d="M232 78 C232 64 170 66 158 52"/>
      </g>

      {/* architecture links */}
      <g stroke="#9aa3b8" strokeWidth="1">
        <line x1="66" y1="30" x2="98" y2="30" markerEnd="url(#welcome-arr)"/>
        <line x1="190" y1="30" x2="212" y2="30" markerEnd="url(#welcome-arr)"/>
      </g>

      {/* Retail Customer */}
      <rect x="6" y="14" width="60" height="32" rx="4" fill="#0b3d6e"/>
      <circle cx="36" cy="9" r="4" fill="#0b3d6e"/>
      <text x="36" y="28" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="600" fontFamily={font}>Retail</text>
      <text x="36" y="37" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="600" fontFamily={font}>Customer</text>

      {/* Core Banking Platform */}
      <rect x="100" y="8" width="90" height="44" rx="4" fill="#1565c0"/>
      <text x="106" y="19" fill="#cfe0f7" fontSize="5" fontWeight="600" letterSpacing="0.4" fontFamily={font}>SOFTWARE SYSTEM</text>
      <text x="106" y="31" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily={font}>Core Banking</text>
      <text x="106" y="41" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily={font}>Platform</text>

      {/* SWIFT Network (external) */}
      <rect x="214" y="12" width="60" height="36" rx="4" fill="#6b7280"/>
      <text x="219" y="22" fill="#e5e7eb" fontSize="5" fontWeight="600" letterSpacing="0.4" fontFamily={font}>EXTERNAL</text>
      <text x="219" y="34" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily={font}>SWIFT</text>

      {/* ADR */}
      <rect x="6" y="98" width="78" height="26" rx="4" fill="#fdf3ea" stroke="#b4581a"/>
      <text x="12" y="108" fill="#b4581a" fontSize="5" fontWeight="700" letterSpacing="0.4" fontFamily={font}>ADR-001</text>
      <text x="12" y="118" fill="#5c2e0e" fontSize="6.5" fontWeight="600" fontFamily={font}>Event-Driven Core</text>

      {/* Requirement */}
      <rect x="96" y="98" width="86" height="26" rx="4" fill="#e8f6f6" stroke="#0f766e"/>
      <text x="102" y="108" fill="#0f766e" fontSize="5" fontWeight="700" letterSpacing="0.4" fontFamily={font}>REQUIREMENT</text>
      <text x="102" y="118" fill="#134e4a" fontSize="6.5" fontWeight="600" fontFamily={font}>Strong customer auth</text>

      {/* Mockup with a wireframe */}
      <rect x="196" y="80" width="78" height="64" rx="4" fill="#fff" stroke="#b3134f"/>
      <path d="M196 84a4 4 0 0 1 4-4h70a4 4 0 0 1 4 4v6h-78z" fill="#b3134f"/>
      <text x="201" y="88" fill="#fff" fontSize="5" fontWeight="700" letterSpacing="0.3" fontFamily={font}>New Transfer</text>
      <g fill="#e5e7eb">
        <rect x="202" y="96" width="40" height="4" rx="1"/>
        <rect x="202" y="104" width="66" height="7" rx="1.5"/>
        <rect x="202" y="114" width="66" height="7" rx="1.5"/>
      </g>
      <rect x="202" y="127" width="30" height="9" rx="2" fill="#3b6fe6"/>
    </svg>
  )
}

export function WelcomeScreen({ onDismiss }: Props): React.ReactElement {
  // The doc auto-seeded on a first visit is not the user's work: leave it out
  // so newcomers are not greeted by a model they never made.
  const existingDocs = documents.listDocuments().filter(d => !documents.isBootSeeded(d.id))
  const hasExisting  = existingDocs.length > 0
  const browserDocs  = existingDocs.filter(d => d.source === 'ls')
  // AI settings live behind the logo menu, which this overlay covers, so
  // reading them once is enough.
  const [forgeAvailable] = useState(() => aiReady(loadAISettings()))
  /** The right column: the two choices, then what "New model" or "Open"
   *  needs to know. */
  const [step, setStep] = useState<'start' | 'new' | 'open' | 'open-browser'>('start')

  // Escape steps back.
  useEffect(() => {
    if (step === 'start') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setStep(step === 'open-browser' ? 'open' : 'start')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  const back = (
    <button type="button" className="msteps-back" onClick={() => setStep(step === 'open-browser' ? 'open' : 'start')}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M10 6H2M5.5 2.5L2 6l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )

  return (
    <div className="welcome-overlay">
      <div className="welcome-card">

        {/* ── Left column: what this is ── */}
        <div className="welcome-left">
          <div className="welcome-wordmark">
            <svg className="welcome-wordmark-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="4.5" fill="#3b6fe6"/>
                <circle cx="14" cy="14" r="12" stroke="#3b6fe6" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
                <circle cx="14" cy="2"  r="2" fill="#3b6fe6" opacity="0.45"/>
                <circle cx="14" cy="26" r="2" fill="#3b6fe6" opacity="0.45"/>
                <circle cx="2"  cy="14" r="2" fill="#3b6fe6" opacity="0.45"/>
                <circle cx="26" cy="14" r="2" fill="#3b6fe6" opacity="0.45"/>
            </svg>
            <span className="welcome-wordmark-text">studio <span className="welcome-wordmark-by">by radical<em>.tools</em></span></span>
          </div>
          {/* The website's words (apps/web/index.html), so both say the same. */}
          <h1 className="welcome-heading">
            Architecture that lives here, <span>and holds whatever builds from it.</span>
          </h1>
          <p className="welcome-lead">
            One model, built by you or by AI, that becomes the harness for
            whatever builds from it.
          </p>
          <SamplePreview />
        </div>

        {/* ── Right column: New model or Open, then the details ── */}
        <div className="welcome-right">
          {step === 'start' && (
            <div className="welcome-start">
              <button
                type="button"
                className="welcome-choice welcome-choice-primary"
                onClick={() => setStep('new')}
                aria-label="New model"
                aria-describedby="welcome-new-desc"
              >
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <span className="welcome-choice-text">
                  <span className="welcome-choice-title">New model</span>
                  <span className="welcome-choice-desc" id="welcome-new-desc">
                    {forgeAvailable
                      ? 'Empty or with Radical Forge, kept in this browser, a file or a folder'
                      : 'Pick a metamodel, keep it in this browser, a file or a folder'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="welcome-choice"
                onClick={() => setStep('open')}
                aria-label="Open"
                aria-describedby="welcome-open-desc"
              >
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                <span className="welcome-choice-text">
                  <span className="welcome-choice-title">Open</span>
                  <span className="welcome-choice-desc" id="welcome-open-desc">
                    From this browser, a file, a folder, or the sample
                  </span>
                </span>
              </button>

              {/* A newcomer has no models yet: the sample shows what the tool
                  does, with no AI key and no blank canvas. */}
              {!hasExisting && (
                <button type="button" className="welcome-sample-link" onClick={() => openSample(onDismiss, true)}>
                  Try the sample model
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              {/* The last few models, one click away; the full list is under Open. */}
              {hasExisting && (
                <div className="welcome-start-recent">
                  <p className="msteps-label">Recent</p>
                  <div className="msteps-rows">
                    {existingDocs.slice(0, 3).map(doc => <ModelRow key={doc.id} doc={doc} onOpen={onDismiss} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'new' && (
            <div className="msteps">
              {back}
              <h2 className="msteps-title">New model</h2>
              <NewModelStep onDone={onDismiss} />
            </div>
          )}

          {step === 'open' && (
            <div className="msteps">
              {back}
              <h2 className="msteps-title">Open</h2>
              {hasExisting && (
                <>
                  <p className="msteps-label">Recent</p>
                  <div className="msteps-rows">
                    {/* The last model is one Enter away. */}
                    {existingDocs.slice(0, 5).map((doc, i) => (
                      <ModelRow key={doc.id} doc={doc} onOpen={onDismiss} autoFocus={i === 0} />
                    ))}
                  </div>
                  <div className="msteps-divider" />
                </>
              )}
              <OpenSources
                onDone={onDismiss}
                setRoute
                autoFocus={false}
                before={
                  <StepRow
                    icon={<BrowserIcon />}
                    name="In this browser…"
                    meta={browserDocs.length === 1 ? '1 model' : `${browserDocs.length} models`}
                    onClick={() => setStep('open-browser')}
                    autoFocus={!hasExisting}
                  />
                }
              />
            </div>
          )}

          {step === 'open-browser' && (
            <div className="msteps">
              {back}
              <h2 className="msteps-title">In this browser</h2>
              {browserDocs.length > 0 ? (
                <div className="msteps-rows msteps-rows-scroll">
                  {browserDocs.map((doc, i) => <ModelRow key={doc.id} doc={doc} onOpen={onDismiss} autoFocus={i === 0} />)}
                </div>
              ) : (
                <p className="msteps-empty">No models are kept in this browser yet.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
