// ─── Radical Forge stage prompts ────────────────────────────────────────────
// Radical Forge walks a free-text system description through four sequential
// AI generation stages — requirements → fitness functions → Gherkin
// scenarios → C4 model — each a normal `runAIPrompt` call sharing one
// running `history` array — so a later stage sees everything an earlier
// stage created (via buildContextMessage in systemPrompt.ts), same as any
// multi-turn chat. No new AI infrastructure: these are just task-scoped
// prompt strings.
//
// C4 deliberately runs LAST: the behavior/quality spec (requirements,
// fitness functions, scenarios) is nailed down first, and the architecture
// follows from it rather than the other way around. This changes how
// fitness functions link back — with no C4 elements to `constrains` yet,
// they're linked from the requirement side via `traces-to` instead; once C4
// runs last, it links the elements it creates to matching fitness-fns via
// `constrains` (see the governance metamodel preset for why the relation
// only goes fitness-fn/adr/requirement → C4-element, never the reverse).

import type { HubConceptSummary } from '../store/hubStore'

export type ForgeStageId = 'requirements' | 'fitness' | 'scenarios' | 'c4'

export interface ForgeStage {
  id: ForgeStageId
  title: string
  /** Shown in the wizard UI above the Generate button. */
  blurb: string
}

/** The node type(s) each stage is actually meant to create — used to scope
 *  the metamodel context message down to full detail for these (plus
 *  whatever's already in the diagram) and abbreviated for the rest (see
 *  ai/systemPrompt.ts's `buildMetamodelMessage`). */
export const PRIMARY_TYPE_IDS_FOR_STAGE: Record<ForgeStageId, string[]> = {
  requirements: ['requirement'],
  fitness: ['fitness-fn'],
  scenarios: ['scenario'],
  c4: ['person', 'system', 'container', 'component', 'database', 'webapp', 'queue', 'domain', 'group'],
}

export const FORGE_STAGES: ForgeStage[] = [
  {
    id: 'requirements',
    title: 'Requirements',
    blurb: 'Extract functional requirements from the description, written as EARS statements.',
  },
  {
    id: 'fitness',
    title: 'Fitness functions',
    blurb: 'Propose measurable guardrails (fitness functions) constraining those requirements.',
  },
  {
    id: 'scenarios',
    title: 'Gherkin scenarios',
    blurb: 'Write Given/When/Then scenarios that verify each requirement.',
  },
  {
    id: 'c4',
    title: 'C4 model',
    blurb: 'Derive the system/container/component structure that satisfies the spec above.',
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

/** Formats a compact synopsis of earlier stages in this run — replaces
 *  carrying their full verbatim tool-call transcripts forward (which
 *  `RadicalForgeModal.tsx` used to do via a growing `history` array). The
 *  live diagram-context message (systemPrompt.ts's `buildContextMessage`)
 *  already re-sends the complete, authoritative current model state fresh
 *  every round, so replaying raw tool calls on top of that was mostly
 *  redundant — this keeps just the "what was decided and why" that a fresh
 *  state dump can't carry on its own. */
export function buildPriorStagesBlock(summaries: { title: string; summary: string }[]): string {
  const withText = summaries.filter((s) => s.summary.trim())
  if (!withText.length) return ''
  return [
    '',
    'Summary of earlier stages in this run (the full current model state is',
    'given separately above — this is just what each stage decided and why):',
    ...withText.map((s) => `- ${s.title}: ${s.summary.trim()}`),
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
 *  (ai/forgeClarify.ts), when the user answered any. `priorStageSummaries`
 *  is the pre-formatted output of `buildPriorStagesBlock` above. */
export function buildForgeStagePrompt(
  stageId: ForgeStageId,
  description: string,
  hubMatches?: HubConceptSummary[],
  clarifications?: string,
  priorStageSummaries?: string,
): string {
  const descBlock = [
    'Original system description (provided by the user in the Radical Forge wizard):',
    '"""',
    description.trim(),
    '"""',
    priorStageSummaries,
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
        'Task: using the requirements, fitness functions and Gherkin scenarios already',
        'in the model, plus the description above, derive the C4 structure — the',
        'people/systems/containers/components involved — and the relations between',
        'them. This is the last stage: the behavior and quality spec is already fully',
        'formed, so let the architecture follow from it rather than guessing ahead of',
        'it — e.g. a fitness function with a tight latency threshold or a scenario',
        'implying an async flow should visibly shape how you decompose the system.',
        'Link each element to the requirement(s) it satisfies with a `satisfies`',
        'relation, AND link each existing `fitness-fn` node to whichever new element(s)',
        'it actually constrains with a `constrains` relation (this only becomes',
        'possible now that real elements exist for it to point at). Do not invent',
        'requirements at this stage; if the description implies something not yet',
        'covered by a requirement, model the C4 element anyway but leave it unlinked',
        'rather than fabricating a requirement here.',
      ].join('\n')

    case 'fitness':
      return [
        descBlock,
        '',
        'Task: propose fitness functions (`fitness-fn` nodes) that constrain the',
        'requirements already in the model — measurable guardrails for things like',
        'latency, availability, coupling, security posture, or delivery flow implied',
        'by the description. Set `category` and a concrete `threshold` for each. No',
        'systems/containers exist yet (C4 runs later, once this spec is settled), so',
        'link each fitness function to the requirement(s) it constrains with a',
        '`traces-to` relation FROM the requirement TO the fitness function (the',
        'reverse direction isn\'t valid in the metamodel) rather than `constrains`.',
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
