// ─── Radical Forge — concern packs ──────────────────────────────────────────
// How a Forge run settles the concerns of the Hub's packs (../../concerns.ts):
// the Requirements stage's clarify step offers the packs and the model
// picks those the description calls for, answering the questions the
// description settles; the baseline packs every system needs (and, for a
// system people use through screens, the screen packs) are always among the
// picks. The user sees each pick checked and unchecks what does not apply;
// the kept packs' questions join the stage's questions, those answers
// proposed for the user to accept or change; once answered, each kept pack
// comes into the model whole and unbound before the stage is generated;
// every later stage is told what is decided, and the C4 stage what to link;
// after it, what is still unbound is bound where the pack's trigger points.
// The Review stage's clarify step does the same for the concerns the model
// raises by then that no decision settles (concern-unaddressed): each the
// user settles comes in bound at once where its trigger points. Studio's
// wizard and the MCP server's forge_* tools share it. ADR Forge settles
// concerns, C4 binds them.

import type { C4Node, C4Relation } from '../../c4'
import { bindSuggestions, CONCERN_KEY, openConcerns, suggestedCover, type ConcernPack } from '../../concerns'
import type { ConceptInsert } from '../../hubImport'
import type { Metamodel } from '../../metamodel'
import type { ClarifyStageQuestion } from './clarify'
import type { ForgeStageId } from './prompts'

/** The clarify question in which the model names the packs it picks, and
 *  in which the user unchecks those that do not apply. */
export const CONCERNS_QUESTION_ID = 'concerns'
/** The ids of a picked pack's questions: `concern:<pack id>:<KEY>`. */
export const CONCERN_QUESTION_PREFIX = 'concern:'

/** The packs of the good practices every system needs, proposed in every
 *  Requirements stage: how a change is built, tested, released and gated. */
export const BASELINE_PACK_IDS: readonly string[] = ['concern-ci-cd-pipeline', 'concern-test-strategy', 'concern-release-versioning', 'concern-code-quality-gate']
/** The packs of the good practices of a system people use through screens
 *  (a web, mobile or desktop app), proposed when the model picks one. */
export const SCREEN_PACK_IDS: readonly string[] = ['concern-usability', 'concern-accessibility', 'concern-mobile-performance']

/** The stages whose clarify step settles concerns: Requirements offers the
 *  Hub's packs, Review the concerns the model raises and has not settled. */
export type ConcernsStage = 'requirements' | 'review'

/** Whether a stage settles concerns, and which way. */
export const concernsStageOf = (stage: ForgeStageId): ConcernsStage | undefined =>
  stage === 'requirements' || stage === 'review' ? stage : undefined

/** A picked pack's question the model answered from the description. */
export interface ConcernProposal {
  pack: string
  key: string
  /** One of the question's option values (or labels). */
  answer: string
  /** The description's words the answer rests on. */
  because?: string
}

/** What the clarify prompt says about the packs beyond the list: the stage,
 *  and in Review what each open concern applies to (labels, by pack id). */
export interface ConcernsClarifyOptions {
  stage?: ConcernsStage
  appliesTo?: Record<string, string[]>
}

const packLine = (p: ConcernPack, appliesTo?: string[]): string =>
  `- ${p.id} | ${p.name}: ${p.description}${appliesTo?.length ? ` Open for: ${appliesTo.map((l) => `"${l}"`).join(', ')}.` : ''}`

const among = (packs: ConcernPack[], ids: readonly string[]): ConcernPack[] =>
  ids.map((id) => packs.find((p) => p.id === id)).filter((p): p is ConcernPack => !!p)

/** What a clarify prompt says about the packs: in Requirements the Hub's
 *  packs to pick from, the baseline ones always among the picks; in Review
 *  the concerns the model raises that are still open. */
export function concernsClarifyLines(packs: ConcernPack[], mode: 'json' | 'ask', options: ConcernsClarifyOptions = {}): string[] {
  if (!packs.length) return []
  if (options.stage === 'review') return reviewClarifyLines(packs, mode, options.appliesTo ?? {})
  const baseline = among(packs, BASELINE_PACK_IDS)
  const screens = among(packs, SCREEN_PACK_IDS)
  const names = (list: ConcernPack[]) => list.map((p) => p.name).join(', ')
  const lines = [
    '',
    'Concern packs of the Hub (id | name: what it settles). Each brings the requirements, the decision, its',
    'fitness functions and scenarios for one concern, as the user\'s answers to its questions pick them:',
    ...packs.map((p) => packLine(p)),
    '',
    'Pick the packs whose concern this system clearly has, from the description in whatever language it is',
    'written (people sign in, data about people is kept, other systems are called, …).',
  ]
  if (baseline.length) {
    lines.push(
      `Always include the baseline packs: ${names(baseline)}. They are the good practices every system needs`,
      '(how a change is built, tested, released and held to a quality gate); the user unchecks what does not apply.',
    )
  }
  if (screens.length) {
    lines.push(
      `When people use the system through screens (a web, mobile or desktop app), also include ${names(screens)}:`,
      'the good practices of what people see and use. Leave them out for a system nobody uses through a screen.',
    )
  }
  if (!baseline.length) lines.push('None if none fits.')
  if (mode === 'ask') {
    lines.push(
      'Present your picks to the user as proposed, each checked, the baseline packs among them, and let the user',
      'drop any that does not apply. Where the description clearly settles one of a kept pack\'s',
      'questions (listed below), propose the answer, quoting the words of the description it rests on, and ask',
      'the user to accept or change those answers; ask the other questions with their options. Answer only what',
      'the description says, not what is usual. Pass the packs the user kept, with the answers the user accepted',
      'or gave, to forge_generate as concerns; a pack the user dropped is left out.',
    )
  } else {
    lines.push(
      `Include one question with id "${CONCERNS_QUESTION_ID}", kind "select", multiSelect true, whose options are the`,
      `names of your picks exactly as written above, asking which of them to settle now.${baseline.length ? '' : ' Leave it out if none fits.'}`,
      ...jsonAnswerLines(),
    )
  }
  return lines
}

function reviewClarifyLines(packs: ConcernPack[], mode: 'json' | 'ask', appliesTo: Record<string, string[]>): string[] {
  const lines = [
    '',
    'These concerns the model raises are still open: Hub concern packs whose concern applies to elements of the',
    'model that no accepted decision settles (id | name: what it settles, and where it is open). Settle them',
    'before Forge ends. Each brings the requirements, the decision, its fitness functions and scenarios for its',
    'concern, as the user\'s answers to its questions pick them, bound to the elements it is open for:',
    ...packs.map((p) => packLine(p, appliesTo[p.id])),
    '',
  ]
  if (mode === 'ask') {
    lines.push(
      'Present all of them to the user as proposed, each checked, and let the user drop any that does not apply.',
      'Where the description or the earlier answers clearly settle one of a kept pack\'s questions (listed below),',
      'propose the answer, quoting the words it rests on, and ask the user to accept or change those answers; ask',
      'the other questions with their options. Pass the packs the user kept, with the answers the user accepted or',
      'gave, to forge_generate as concerns: each comes into the model bound at once where its concern applies.',
    )
  } else {
    lines.push(
      `Include one question with id "${CONCERNS_QUESTION_ID}", kind "select", multiSelect true, whose options are the`,
      'names of all of them exactly as written above, asking which of them to settle now.',
      ...jsonAnswerLines(),
    )
  }
  return lines
}

const jsonAnswerLines = (): string[] => [
  'Do not ask the packs\' own questions (listed below): they are added for the picks. Where the description',
  `clearly settles one of a pick's questions, add to the "${CONCERNS_QUESTION_ID}" question an "answers" array of`,
  '{"pack": pack id, "key": question key, "answer": option value, "because": the words of the description it',
  'rests on, quoted as written}. Answer only what the description says, not what is usual: the user sees',
  'each answer with its words and accepts or changes it.',
]

/** The packs' questions, for the model to answer what the description
 *  settles (and, over MCP, to ask the rest): key, question, options. */
export function concernQuestionLines(packs: ConcernPack[]): string[] {
  if (!packs.length) return []
  return [
    '',
    'The packs\' questions (key: question [value = answer; …], default):',
    ...packs.flatMap((p) => [
      `- ${p.id} (${p.name}):`,
      ...(p.templateParams ?? []).map((q) => `  - ${q.key}: ${q.label}${q.options?.length ? ` [${q.options.map((o) => `${o.value} = ${o.label}`).join('; ')}]` : ''}${q.defaultValue ? ` (default ${q.defaultValue})` : ''}`),
    ]),
  ]
}

/** The packs proposed whatever the model picked: in Requirements the
 *  baseline packs, and the screen packs once the model picked one of them;
 *  in Review every open concern. Only those `packs` has. */
export function alwaysProposed(packs: ConcernPack[], picked: ConcernPack[], stage: ConcernsStage = 'requirements'): ConcernPack[] {
  if (stage === 'review') return packs
  const screens = picked.some((p) => SCREEN_PACK_IDS.includes(p.id)) ? among(packs, SCREEN_PACK_IDS) : []
  return [...among(packs, BASELINE_PACK_IDS), ...screens]
}

/** The packs the model picked in its clarify reply (the concerns question's
 *  options, by name or id), and those always proposed (alwaysProposed),
 *  with a concerns question in which the user unchecks the picks that do
 *  not apply (all checked to begin with), and the picked packs' questions
 *  with options added after the rest; a question the model answered from
 *  the description starts at that answer, marked with its words, and an
 *  answer that is none of its options is dropped. */
export function withConcernQuestions(
  questions: ClarifyStageQuestion[], packs: ConcernPack[], stage: ConcernsStage = 'requirements',
): { questions: ClarifyStageQuestion[]; picked: ConcernPack[] } {
  const picked: ConcernPack[] = []
  const rest: ClarifyStageQuestion[] = []
  const proposals: ConcernProposal[] = []
  for (const q of questions) {
    if (q.id !== CONCERNS_QUESTION_ID) { rest.push(q); continue }
    if (Array.isArray(q.answers)) proposals.push(...q.answers.filter(isProposal))
    for (const option of q.options ?? []) {
      const key = option.trim().toLowerCase()
      const p = packs.find((x) => x.name.toLowerCase() === key || x.id === option.trim())
      if (p && !picked.includes(p)) picked.push(p)
    }
  }
  for (const p of alwaysProposed(packs, picked, stage)) if (!picked.includes(p)) picked.push(p)
  if (!picked.length) return { questions: rest, picked }
  const choose: ClarifyStageQuestion = {
    id: CONCERNS_QUESTION_ID,
    question: stage === 'review'
      ? 'Concerns the model raises that are still open: settle them now (uncheck any that does not apply)'
      : 'Hub concern packs to bring in: good practices this system needs (uncheck any that does not apply)',
    kind: 'select',
    multiSelect: true,
    options: picked.map((p) => p.name),
  }
  const asked = picked.flatMap((p) => (p.templateParams ?? []).filter((q) => q.options?.length).map((q): ClarifyStageQuestion => {
    const proposal = proposals.find((a) => (a.pack === p.id || a.pack === p.name) && a.key === q.key)
    const proposed = proposal && q.options!.find((o) => o.value === proposal.answer || o.label === proposal.answer)
    return {
      id: `${CONCERN_QUESTION_PREFIX}${p.id}:${q.key}`,
      question: `${p.name} — ${q.label}`,
      kind: 'select',
      options: q.options!.map((o) => o.label),
      ...(proposed
        ? { defaultOption: proposed.label, fromDescription: proposal.because?.trim() ?? '' }
        : q.defaultValue ? { defaultOption: q.options!.find((o) => o.value === q.defaultValue)?.label } : {}),
    }
  }))
  return { questions: [...rest, choose, ...asked], picked }
}

/** The picks the user kept: those still checked in the concerns question;
 *  every pick while it is not answered (the questions skipped). */
export function keptConcernPacks(picked: ConcernPack[], answers: Record<string, string | string[]> | undefined): ConcernPack[] {
  const raw = answers?.[CONCERNS_QUESTION_ID]
  if (raw === undefined) return picked
  const kept = new Set(Array.isArray(raw) ? raw : [raw])
  return picked.filter((p) => kept.has(p.name) || kept.has(p.id))
}

/** The clarify questions to show: an unchecked pack's questions left out. */
export function shownClarifyQuestions(
  questions: ClarifyStageQuestion[], picked: ConcernPack[], answers: Record<string, string | string[]> | undefined,
): ClarifyStageQuestion[] {
  const kept = new Set(keptConcernPacks(picked, answers).map((p) => p.id))
  const dropped = picked.filter((p) => !kept.has(p.id)).map((p) => `${CONCERN_QUESTION_PREFIX}${p.id}:`)
  return questions.filter((q) => !dropped.some((prefix) => q.id.startsWith(prefix)))
}

/** The Review stage's concerns: the packs whose concern the model raises
 *  and no accepted decision settles (concern-unaddressed), with the labels
 *  of the elements each is open for. */
export function openConcernsForReview(
  packs: ConcernPack[], nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel: Metamodel | undefined,
): { packs: ConcernPack[]; appliesTo: Record<string, string[]> } {
  const open = openConcerns(packs, nodes, relations, metamodel)
  return {
    packs: open.map((s) => s.pack),
    appliesTo: Object.fromEntries(open.map((s) => [s.pack.id, s.open.map((id) => nodes[id].label)])),
  }
}

/** Where a pack is bound: the fewest elements that settle every element its
 *  concern is open for (or, with none open, applies to). */
export function concernBindTargets(pack: ConcernPack, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel: Metamodel | undefined): string[] {
  return suggestedCover(bindSuggestions(pack, nodes, relations, metamodel))
}

/** A line for what the Review stage settled: each pack, where it was bound. */
export function reviewConcernLine(settled: Array<{ name: string; boundTo: string[] }>, nodes: Record<string, C4Node>): string {
  if (!settled.length) return ''
  return `Settled the open concerns the user confirmed, each bound where its concern applies: ${settled
    .map((s) => `${s.name} (${s.boundTo.length ? s.boundTo.map((id) => `"${nodes[id]?.label ?? id}"`).join(', ') : 'unbound: nothing it applies to'})`).join(', ')}.`
}

function isProposal(v: unknown): v is ConcernProposal {
  const a = v as Partial<ConcernProposal> | null
  return !!a && typeof a.pack === 'string' && typeof a.key === 'string' && typeof a.answer === 'string'
    && (a.because === undefined || typeof a.because === 'string')
}

/** A picked pack's answers from the clarify form (option labels) as values
 *  by question key; a question left unanswered takes its default. */
export function concernAnswersOf(pack: ConcernPack, answers: Record<string, string | string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of pack.templateParams ?? []) {
    const raw = answers?.[`${CONCERN_QUESTION_PREFIX}${pack.id}:${q.key}`]
    const label = Array.isArray(raw) ? raw[0] : raw
    const option = q.options?.find((o) => o.label === label || o.value === label)
    if (option) out[q.key] = option.value
  }
  return out
}

/** What a run keeps of a pack it imported: the ids of its elements. */
export interface DecidedConcern {
  packId: string
  name: string
  concern: string
  adrIds: string[]
  fitnessIds: string[]
  requirementIds: string[]
}

export function decidedConcern(pack: ConcernPack, insert: ConceptInsert): DecidedConcern {
  const ids = (type: string) => Object.values(insert.nodes).filter((n) => n.type === type).map((n) => n.id)
  return { packId: pack.id, name: pack.name, concern: pack.concern.id, adrIds: ids('adr'), fitnessIds: ids('fitness-fn'), requirementIds: ids('requirement') }
}

/** What a stage's prompt says about the concerns the run settled: decided,
 *  so nothing of its own; and in C4, what to link to the elements it makes. */
export function buildConcernsBlock(stageId: ForgeStageId, decided: DecidedConcern[] | undefined, nodes: Record<string, C4Node>): string {
  const present = (decided ?? []).filter((d) => d.adrIds.some((id) => nodes[id]))
  if (!present.length) return ''
  const label = (id: string) => `${id} "${nodes[id]?.label ?? ''}"`
  const lines = [
    '',
    'Concerns already decided by Hub concern packs in the model, with the user\'s answers. Do not write a',
    'requirement, decision or fitness function of your own for them; build on what they say:',
    ...present.map((d) => `- ${d.name}: ${d.adrIds.filter((id) => nodes[id]).map(label).join(', ')}`),
  ]
  if (stageId === 'c4') {
    lines.push(
      '',
      'Link each of them to the elements it is about as you create those (the ones people or other systems',
      'reach for authentication, the stores for personal data and backups, and so on): add_relation constrains',
      'from the decision and from each of its fitness functions to the element, and satisfies from the element',
      'to each of its requirements. A system covers what it contains.',
      ...present.map((d) => `- ${d.name}: decision ${d.adrIds.join(', ')}; fitness functions ${d.fitnessIds.join(', ') || 'none'}; requirements ${d.requirementIds.join(', ') || 'none'}`),
    )
  }
  return lines.join('\n')
}

/** After the C4 stage: the relations that bind each decided pack whose
 *  decision constrains nothing to where its trigger points (suggestedCover),
 *  and a line for each, for the stage's summary. */
export function bindUnboundConcerns(
  decided: DecidedConcern[], packs: ConcernPack[],
  nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel: Metamodel | undefined,
): { relations: Array<Omit<C4Relation, 'id'>>; lines: string[] } {
  const out: Array<Omit<C4Relation, 'id'>> = []
  const lines: string[] = []
  const constrains = new Set(Object.values(relations).filter((r) => r.relationType === 'constrains').map((r) => r.sourceId))
  for (const d of decided) {
    const adrs = d.adrIds.filter((id) => nodes[id] && (nodes[id] as unknown as Record<string, unknown>)[CONCERN_KEY])
    if (!adrs.length || adrs.some((id) => constrains.has(id))) continue
    const pack = packs.find((p) => p.id === d.packId)
    const where = pack ? concernBindTargets(pack, nodes, relations, metamodel) : []
    if (!where.length) {
      lines.push(`${d.name}: nothing it applies to yet, so its decision is left unbound (concern-unbound reports it).`)
      continue
    }
    for (const el of where) {
      for (const id of [...adrs, ...d.fitnessIds.filter((f) => nodes[f])]) out.push({ sourceId: id, targetId: el, relationType: 'constrains' })
      for (const id of d.requirementIds.filter((r) => nodes[r])) out.push({ sourceId: el, targetId: id, relationType: 'satisfies' })
    }
    lines.push(`${d.name}: the stage linked it to nothing, so it was bound to ${where.map((id) => `"${nodes[id].label}"`).join(', ')}, where its concern applies.`)
  }
  return { relations: out, lines }
}
