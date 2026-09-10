// ─── Radical Forge stage prompts ────────────────────────────────────────────
// Radical Forge walks a free-text system description through four sequential
// AI generation stages (requirements → C4 model → fitness functions →
// Gherkin scenarios), each a normal `runAIPrompt` call sharing one running
// `history` array — so a later stage sees everything an earlier stage
// created (via buildContextMessage in systemPrompt.ts), same as any multi-turn
// chat. No new AI infrastructure: these are just task-scoped prompt strings.

import type { HubConceptSummary } from '../store/hubStore'

export type ForgeStageId = 'requirements' | 'c4' | 'fitness' | 'scenarios'

export interface ForgeStage {
  id: ForgeStageId
  title: string
  /** Shown in the wizard UI above the Generate button. */
  blurb: string
}

export const FORGE_STAGES: ForgeStage[] = [
  {
    id: 'requirements',
    title: 'Requirements',
    blurb: 'Extract functional requirements from the description, written as EARS statements.',
  },
  {
    id: 'c4',
    title: 'C4 model',
    blurb: 'Derive the system/container/component structure and relations that satisfy those requirements.',
  },
  {
    id: 'fitness',
    title: 'Fitness functions',
    blurb: 'Propose measurable guardrails (fitness functions) constraining the model above.',
  },
  {
    id: 'scenarios',
    title: 'Gherkin scenarios',
    blurb: 'Write Given/When/Then scenarios that verify each requirement.',
  },
]

/** Formats Hub catalogue matches (see hub/matchConcepts.ts) as prior-art
 *  guidance: the model is told to apply the principles these concepts
 *  embody — proven decomposition/coupling patterns, ADR precedent, fitness-
 *  function thresholds — rather than re-deriving everything from scratch,
 *  while being explicit that only a real add_node call creates a node (so
 *  it doesn't just claim to have "imported" one in prose). */
function buildHubGuidanceBlock(hubMatches: HubConceptSummary[] | undefined): string {
  if (!hubMatches?.length) return ''
  const lines = hubMatches.map((c) => {
    const tags = c.tags.length ? ` (tags: ${c.tags.join(', ')})` : ''
    return `- [${c.category}] ${c.name}: ${c.description}${tags}`
  })
  return [
    '',
    'Relevant prior art already in the Hub catalogue — apply these principles',
    '(proven decomposition/coupling patterns, ADR precedent, fitness-function',
    'thresholds) where they fit this system, and reference one by name in a',
    "node's `description` when you follow it. Do not claim to have \"imported\"",
    'one in prose — only a real add_node/add_relation call creates something:',
    ...lines,
  ].join('\n')
}

/** Formats the user's answers to the pre-stage clarifying questions (see
 *  ai/forgeClarify.ts) as a block the model should treat as authoritative —
 *  it asked, the user answered, so these override any conflicting guess it
 *  would otherwise make from the free-text description alone. */
function buildClarificationsBlock(clarifications: string | undefined): string {
  if (!clarifications?.trim()) return ''
  return [
    '',
    "User's answers to your clarifying questions — treat these as authoritative:",
    clarifications.trim(),
  ].join('\n')
}

/** Builds the task instruction for one stage. `description` is the original
 *  free-text system description the user provided in the Input step — later
 *  stages still get it for grounding, even though the requirements/model it
 *  implies are by then already in the live diagram (and thus in `history`).
 *  `hubMatches` are the same Hub suggestions shown in the wizard UI for this
 *  stage (see RadicalForgeModal.tsx) — generation and what the user sees
 *  stay the same set, no separate "what did the AI see" mystery.
 *  `clarifications` is the formatted Q&A from the pre-stage clarify step
 *  (ai/forgeClarify.ts), when the user answered any. */
export function buildForgeStagePrompt(
  stageId: ForgeStageId,
  description: string,
  hubMatches?: HubConceptSummary[],
  clarifications?: string,
): string {
  const descBlock = [
    'Original system description (provided by the user in the Radical Forge wizard):',
    '"""',
    description.trim(),
    '"""',
    buildHubGuidanceBlock(hubMatches),
    buildClarificationsBlock(clarifications),
  ].filter(Boolean).join('\n')

  switch (stageId) {
    case 'requirements':
      return [
        descBlock,
        '',
        'Task: read the description above and extract its functional requirements as',
        '`requirement` nodes (EARS). Pick the right `ears_type` per requirement — do not',
        'default everything to "ubiquitous". Keep each requirement scoped to one',
        'behaviour; split compound sentences into several requirements and, where one',
        'clearly refines another, link child → parent with a `derives` relation.',
        'Create only requirement nodes in this stage — no systems, containers, fitness',
        'functions, or scenarios yet.',
      ].join('\n')

    case 'c4':
      return [
        descBlock,
        '',
        'Task: using the requirements already in the model plus the description above,',
        'derive the C4 structure — the people/systems/containers/components involved —',
        'and the relations between them. Link each element to the requirement(s) it',
        'satisfies with a `satisfies` relation. Do not invent requirements at this',
        'stage; if the description implies something not yet covered by a requirement,',
        'model the C4 element anyway but leave it unlinked rather than fabricating a',
        'requirement here.',
      ].join('\n')

    case 'fitness':
      return [
        descBlock,
        '',
        'Task: propose fitness functions (`fitness-fn` nodes) that constrain the systems',
        '/ containers / requirements already in the model — measurable guardrails for',
        'things like latency, availability, coupling, security posture, or delivery',
        'flow implied by the description. Set `category` and a concrete `threshold`',
        'for each. Link each to what it constrains with a `constrains` relation.',
      ].join('\n')

    case 'scenarios':
      return [
        descBlock,
        '',
        'Task: for each `requirement` node already in the model, write 1-3 Gherkin',
        '`scenario` nodes covering its main path and, where it matters, an edge case',
        'or unwanted-behaviour case. Fill `given`/`when`/`then` with concrete steps (not',
        'placeholders) and use the `gherkin` field only for extra `And`/`But` steps.',
        'Link each scenario to the requirement it exercises with a `verifies` relation.',
      ].join('\n')
  }
}
