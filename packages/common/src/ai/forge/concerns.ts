// ─── Radical Forge — concern packs ──────────────────────────────────────────
// How a Forge run settles the concerns of the Hub's packs (../../concerns.ts):
// the Requirements stage's clarify step offers the packs and the model
// picks those the description calls for, answering the questions the
// description settles; their questions join the stage's questions, those
// answers proposed for the user to accept or change; once answered, each picked pack comes into the model whole and
// unbound before the stage is generated; every later stage is told what is
// decided, and the C4 stage what to link; after it, what is still unbound
// is bound where the pack's trigger points. Studio's wizard and the MCP
// server's forge_* tools share it. ADR Forge settles concerns, C4 binds them.

import type { C4Node, C4Relation } from '../../c4'
import { bindSuggestions, CONCERN_KEY, suggestedCover, type ConcernPack } from '../../concerns'
import type { ConceptInsert } from '../../hubImport'
import type { Metamodel } from '../../metamodel'
import type { ClarifyStageQuestion } from './clarify'
import type { ForgeStageId } from './prompts'

/** The clarify question in which the model names the packs it picks. */
export const CONCERNS_QUESTION_ID = 'concerns'
/** The ids of a picked pack's questions: `concern:<pack id>:<KEY>`. */
export const CONCERN_QUESTION_PREFIX = 'concern:'

/** A picked pack's question the model answered from the description. */
export interface ConcernProposal {
  pack: string
  key: string
  /** One of the question's option values (or labels). */
  answer: string
  /** The description's words the answer rests on. */
  because?: string
}

const packLine = (p: ConcernPack): string => `- ${p.id} | ${p.name}: ${p.description}`

/** What the Requirements stage's clarify prompt says about the packs. */
export function concernsClarifyLines(packs: ConcernPack[], mode: 'json' | 'ask'): string[] {
  if (!packs.length) return []
  const lines = [
    '',
    'Concern packs of the Hub (id | name: what it settles). Each brings the requirements, the decision, its',
    'fitness functions and scenarios for one concern, as the user\'s answers to its questions pick them:',
    ...packs.map(packLine),
    '',
    'Pick the packs whose concern this system clearly has, from the description in whatever language it is',
    'written (people sign in, data about people is kept, other systems are called, …); none if none fits.',
  ]
  if (mode === 'ask') {
    lines.push(
      'Ask the user to confirm your picks. Where the description clearly settles one of a confirmed pack\'s',
      'questions (listed below), propose the answer, quoting the words of the description it rests on, and ask',
      'the user to accept or change those answers; ask the other questions with their options. Answer only what',
      'the description says, not what is usual. Pass the packs with the answers the user accepted or gave to',
      'forge_generate as concerns.',
    )
  } else {
    lines.push(
      `Include one question with id "${CONCERNS_QUESTION_ID}", kind "select", multiSelect true, whose options are the`,
      'names of your picks exactly as written above, asking which of them to settle now. Leave it out if none fits.',
      'Do not ask the packs\' own questions (listed below): they are added for the picks. Where the description',
      `clearly settles one of a pick's questions, add to the "${CONCERNS_QUESTION_ID}" question an "answers" array of`,
      '{"pack": pack id, "key": question key, "answer": option value, "because": the words of the description it',
      'rests on, quoted as written}. Answer only what the description says, not what is usual: the user sees',
      'each answer with its words and accepts or changes it.',
    )
  }
  return lines
}

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

/** The packs the model picked in its clarify reply (the concerns question's
 *  options, by name or id), with that question taken out, and the picked
 *  packs' questions with options added after the rest; a question the model
 *  answered from the description starts at that answer, marked with its
 *  words, and an answer that is none of its options is dropped. */
export function withConcernQuestions(
  questions: ClarifyStageQuestion[], packs: ConcernPack[],
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
  return { questions: [...rest, ...asked], picked }
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
    const where = pack ? suggestedCover(bindSuggestions(pack, nodes, relations, metamodel)) : []
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
