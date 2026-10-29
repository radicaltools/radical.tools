// ─── Answers panel ───────────────────────────────────────────────────────────
//
// A concern pack's questions beside its preview: picking an answer shows the
// pack as Studio's concern wizard would import it with those answers. Each
// option says how many elements it would add or remove from what the current
// answers bring in; All shows every variant at once.

import React from 'react'
import type { HubConcept } from '@radical/common/hubFormat'
import { answerDelta, packQuestions } from './conceptToDiagram'

interface AnswersPanelProps {
  concept: HubConcept
  /** null: every variant at once. */
  answers: Record<string, string> | null
  /** How many of the pack's elements the answers bring in. */
  shown: number
  /** What the last answer changed, for a moment. */
  lastChange: { added: number; removed: number } | null
  onAnswer: (key: string, value: string) => void
  onDefaults: () => void
  onAll: () => void
}

function deltaText({ added, removed }: { added: number; removed: number }): string {
  return [added ? `+${added}` : '', removed ? `−${removed}` : ''].filter(Boolean).join(' ')
}

export function AnswersPanel({ concept, answers, shown, lastChange, onAnswer, onDefaults, onAll }: AnswersPanelProps): React.ReactElement {
  const questions = packQuestions(concept)
  return (
    <aside className="hub-answers" aria-label="Answers">
      <div className="hub-answers-head">
        <span className="hub-answers-title">Answers</span>
        <span className="hub-answers-sub">Pick an answer to see what it brings into the model.</span>
      </div>
      <div className="hub-answers-list">
        {questions.map((q) => (
          <fieldset className="hub-answers-q" key={q.key}>
            <legend title={q.hint}>{q.label}</legend>
            {q.options!.map((o) => {
              const picked = answers?.[q.key] === o.value
              const delta = answers && !picked ? deltaText(answerDelta(concept, answers, q.key, o.value)) : ''
              return (
                <label className={`hub-answers-opt${picked ? ' picked' : ''}`} key={o.value} title={o.description}>
                  <input
                    type="radio"
                    name={`answer-${q.key}`}
                    checked={picked}
                    onChange={() => onAnswer(q.key, o.value)}
                  />
                  <span className="hub-answers-label">{o.label}</span>
                  {delta && <span className="hub-answers-delta" aria-label={`${delta} elements`}>{delta}</span>}
                </label>
              )
            })}
          </fieldset>
        ))}
      </div>
      <div className="hub-answers-foot">
        <span className="hub-answers-count">
          {answers ? `${shown} of ${concept.nodes.length} elements` : `All ${concept.nodes.length} elements, every variant`}
        </span>
        {lastChange && (lastChange.added || lastChange.removed) ? <span className="hub-answers-last">Last answer: {deltaText(lastChange)}</span> : null}
        <div className="hub-answers-actions">
          <button type="button" className="hub-link" onClick={onDefaults}>Defaults</button>
          <button type="button" className={`hub-link${answers ? '' : ' active'}`} onClick={onAll}>All</button>
        </div>
      </div>
    </aside>
  )
}
